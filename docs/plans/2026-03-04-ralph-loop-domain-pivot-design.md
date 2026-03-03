# Ralph Loop Domain Pivot Agent - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan after this design is approved.

**Goal:** Implement adaptive domain pivot mechanism in Ralph Loop to enable autonomous recovery from consecutive failures by intelligently selecting new market domains based on current market regime.

**Architecture:** Ralph Loop monitors consecutive failures (≥2). When triggered, MissionAgent evaluates market context (volatility, momentum), identifies forbidden zones (recently failed domains), and selects the domain furthest from forbidden zones. Fitness threshold is temporarily relaxed (0.5 → 0.4) for 3 cycles in new domain to enable bootstrapping.

**Tech Stack:** TypeScript, Zod schemas, existing pipeline_orchestrator, market data APIs

---

## 🏗️ セクション 1: 全体アーキテクチャ

**Ralph Loop ドメイン Pivot の流れ:**

```
[Factor Mining Loop]
  ↓
[consecutiveFailures ≥ 2?]
  ├─ NO → 次サイクル継続
  └─ YES → pivotDomain() 呼び出し
             ↓
       [Market Context 取得（volatility, momentum）]
             ↓
       [Adaptive Domain Selection 実行]
             ├─ 禁止区域特定：最近 N サイクルで失敗したドメイン
             ├─ 市場レジーム判定：high/low volatility
             └─ 最遠ドメイン選択：禁止区域から最も遠い領域
             ↓
       [Fitness 基準 20% 緩和（0.5 → 0.4）]
             ↓
       [consecutiveFailures リセット＆次サイクル開始]
```

**主要コンポーネント:**
- `MissionAgent.pivotDomain()`: 新ドメイン決定ロジック（新規実装）
- `DomainRegistry`: 利用可能なドメイン情報管理（既存拡張）
- `ForbiddenZoneTracker`: 最近失敗したドメイン追跡（新規実装）
- `MarketContextEvaluator`: 市場レジーム判定（新規実装）
- `pipeline_orchestrator.run()`: リセット・基準緩和のトリガー（既存修正）

---

## 💻 セクション 2: 主要コンポーネント実装

**1) `MissionAgent.pivotDomain()` メソッド**

責務：
- 禁止区域（最近 N サイクルの失敗ドメイン）を記録から取得
- 現在の market context（volatility, momentum）を評価
- 利用可能なドメイン（セクター、時間軸、因子タイプ）から禁止区域と最も遠い領域を選択
- 選択理由をログに記録（透明性）

```typescript
pivotDomain(
  currentContext: MarketSnapshot,
  forbiddenZones: DomainID[],
  availableDomains: DomainSpec[]
): { newDomain: DomainID; reason: string }
```

**2) `ForbiddenZoneTracker` クラス（新規）**

責務：
- 最近 K サイクル（K=3）の失敗ドメインを管理
- TTL 自動削除（古い失敗情報は徐々に忘却）
- ドメイン距離計算（Euclidean or Cosine similarity）

```typescript
class ForbiddenZoneTracker {
  addFailure(domainID: DomainID, cycle: number): void
  getActiveForbiddenZones(): DomainID[]
  calculateDistance(domain1: DomainID, domain2: DomainID): number
}
```

**3) `MarketContextEvaluator` クラス（新規）**

責務：
- 現在の market volatility / momentum を計算
- レジーム分類（High/Mid/Low volatility）
- ドメイン候補のフィット度評価

```typescript
class MarketContextEvaluator {
  evaluateVolatility(prices: number[]): 'HIGH' | 'MID' | 'LOW'
  suggestDomainsForRegime(regime: string): DomainID[]
}
```

**4) `pipeline_orchestrator` 修正箇所**

```typescript
// processCandidate() メソッド内：
if (consecutiveFailures >= 2) {
  const { newDomain, reason } = await missionAgent.pivotDomain(...)

  // fitness 基準 20% 緩和（一時的）
  fitnessThreshold = 0.4  // from 0.5
  evaluationCyclesForNewDomain = 3

  consecutiveFailures = 0  // リセット
  currentDomain = newDomain
}
```

---

## 🔄 セクション 3: データフロー・状態管理

**エンドツーエンドデータフロー:**

```
[Cycle N: Factor Mining 実行]
  ├─ Audit → verdict = PIVOT (fitness < 0.4 or constraint fail)
  └─ consecutiveFailures++ (N回目の失敗)
       ↓
[consecutiveFailures === 2?]
  └─ YES
       ├─ MarketContextEvaluator.evaluateVolatility()
       │   → prices → 直近 30 営業日の volatility 計算
       │
       ├─ ForbiddenZoneTracker.getActiveForbiddenZones()
       │   → 最近 3 サイクルで失敗したドメイン抽出
       │
       ├─ MissionAgent.pivotDomain()
       │   ├─ suggestDomainsForRegime(volatility)
       │   │   → レジーム適応的なドメイン候補列挙
       │   │
       │   ├─ calculateDistance() で禁止区域から最遠を選択
       │   └─ → newDomain 決定
       │
       ├─ fitnessThreshold = 0.4（一時緩和）
       ├─ evaluationCyclesForNewDomain = 3
       └─ consecutiveFailures = 0（リセット）

[Cycle N+1: 新ドメインで探索再開]
  ├─ fitness 基準 0.4+ で評価（緩和適用）
  └─ 3 サイクル後、基準を 0.5 に戻す
```

**ステート管理：**
- `consecutiveFailures`: パイプライン全体で保持、PIVOT時にリセット
- `forbiddenZones`: 外部 JSON で永続化（session復帰時に復元）
- `fitnessThreshold`: 動的変更可能、デフォルト 0.5、PIVOT直後 0.4

---

## 🛡️ セクション 4: エラー処理・テスト戦略

**エラーハンドリング:**

```typescript
// Edge Case 1: 利用可能なドメインが尽きた
if (availableDomains.empty || allDomainsForbidden) {
  // Fallback：禁止区域を 1 サイクル古化してクリア
  forbiddenZones.prune(ageThresholdCycles: 3)
  // リトライ：最遠ドメインを再選択
}

// Edge Case 2: Market context 取得失敗
if (priceDataUnavailable) {
  // Fallback：保守的にランダムドメイン選択
  newDomain = availableDomains[Math.random() * availableDomains.length]
}

// Edge Case 3: 新ドメインも連続失敗
if (consecutiveFailures >= 2 && currentDomainAge <= 3) {
  // Policy：早期 pivot を避けるため、リセットせず評価続行
  // 代わりに fitness 基準を段階的に 0.3 に緩和
}
```

**テスト戦略:**

| テスト | 対象 | 検証項目 |
|--------|------|--------|
| **Unit** | `ForbiddenZoneTracker` | TTL 削除、距離計算の正確性 |
| **Unit** | `MarketContextEvaluator` | volatility 分類の正確性、regime 別ドメイン提案 |
| **Unit** | `MissionAgent.pivotDomain()` | 禁止区域回避、最遠選択 |
| **Integration** | `pipeline_orchestrator` + `pivotDomain()` | fitnessThreshold 緩和、consecutiveFailures リセット |
| **E2E** | 3+ サイクルループ | 連続失敗時の自動 pivot、新ドメインでの回復 |
| **E2E** | ドメイン枯渇シナリオ | fallback TTL クリア動作 |

---

## 📌 デザイン完成
設計完了。実装計画は writing-plans スキルで作成します。
