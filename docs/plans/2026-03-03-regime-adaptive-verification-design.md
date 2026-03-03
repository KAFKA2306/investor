# 設計ドキュメント：Regime-Adaptive Verification Acceptance

**日付**: 2026-03-03
**著者**: Claude Code + User（Brainstorming Session）
**ステータス**: ✅ Design Approved

---

## Executive Summary

現在のハードコード採用基準（Sharpe > 1.8, IC > 0.04）を、市場レジーム（StateMonitor が発行する RISK_ON/NEUTRAL/RISK_OFF）に応じて **動的に調整** する仕組みを実装する。

### Problem Statement
- 市場が不安定な局面（RISK_OFF）では、Sharpe 1.8 という基準が高すぎて、本来有効な α を取りこぼしている
- 一方で、リスク管理（MaxDrawdown）は市況によらず厳しく保つ必要がある

### Solution
**マルチプライアー型の regime 適応**: ベースライン値を実績データから決定し、regime ごとの乗数（0.35〜1.1）で調整

---

## 1. Architecture

### 1.1 Design Pattern: Multiplier-Based Adaptation

```yaml
verificationAcceptance:
  # ベースライン：過去 3 ヶ月の実績から決定
  baseline:
    minSharpe: 1.0           # bootstrap_baseline.ts で計算
    minIC: 0.02              # bootstrap_baseline.ts で計算
    maxDrawdown: 0.1         # 常に固定（regime 不依存）
    minAnnualizedReturn: 0.0

  # レジーム適応化
  regimeAdaptation:
    enabled: true

    # 各レジームに適用する乗数（multiplier）
    # 実効値 = baseline × multiplier
    multipliers:
      RISK_ON:
        sharpe: 1.1          # 1.0 × 1.1 = 1.1
        ic: 1.0              # 0.02 × 1.0 = 0.02

      NEUTRAL:
        sharpe: 0.9          # 1.0 × 0.9 ≈ 0.9
        ic: 0.8              # 0.02 × 0.8 ≈ 0.016

      RISK_OFF:
        sharpe: 0.35         # 1.0 × 0.35 ≈ 0.35
        ic: 0.25             # 0.02 × 0.25 ≈ 0.005
```

### 1.2 Key Principles

| 原則 | 実装 | 理由 |
|---|---|---|
| **ベースラインは実績ベース** | `bootstrap_baseline.ts` で過去ログから逆算 | 机上の空論ではなく、現実に基づいた基準 |
| **MaxDrawdown は常に厳しく** | regime に関わらず 0.1 で固定 | リスク管理は市況依存しない |
| **Multiplier で相対調整** | Sharpe と IC のみ regime 適応 | 「相対的な緩和度」が直感的で学習しやすい |
| **Regime は既存シグナル活用** | StateMonitor から RISK_ON/OFF を取得 | 新規センサー不要、統合コスト最小 |

### 1.3 Data Flow

```
StateMonitor
  ├─ RISK_ON / NEUTRAL / RISK_OFF を継続発行
  ↓
CqoAgent.auditStrategy(outcome, regime)
  ├─ LesAgent.computeEffectiveCriteria(config, regime) 呼び出し
  ├─ 実効基準を計算（baseline × multiplier[regime]）
  ├─ GO/HOLD/PIVOT を新基準で判定
  ↓
監査ログに記録
  ├─ 使用した regime
  ├─ 適用された基準値
  ├─ GO/HOLD/PIVOT 結果
  ↓
[Phase D] 月次学習ツール
  ├─ 「RISK_OFF で GO した α の実績」を集計
  ├─ マルチプライアー最適化
  ├─ 推奨更新値を提案
```

---

## 2. Implementation Details

### 2.1 Changed Files

| ファイル | 変更内容 |
|---|---|
| `ts-agent/src/config/default.yaml` | `verificationAcceptance` を拡張（baseline + multipliers） |
| `ts-agent/src/schemas/verification.ts` | Zod スキーマで新構造を validate |
| `ts-agent/src/agents/les_agent.ts` | 静的 `EVALUATION_CRITERIA` → `computeEffectiveCriteria(config, regime)` メソッド追加 |
| `ts-agent/src/agents/chief_quant_officer_agent.ts` | `auditStrategy(outcome, regime?)` の第 2 引数追加 |
| `ts-agent/src/system/app_runtime_core.ts` | BaseAgent に regime context 追加（optional） |
| `ts-agent/src/tools/bootstrap_baseline.ts` | **新規**：ログ分析 → baseline 計算ツール |

### 2.2 LesAgent.computeEffectiveCriteria() 実装

```typescript
/**
 * regime に応じた基準を動的計算
 *
 * @param baselineConfig - config から読み込んだ baseline + multipliers
 * @param regime - StateMonitor から取得した regime
 * @returns regime 適応版の EvaluationCriteria
 */
static computeEffectiveCriteria(
  baselineConfig: VerificationAcceptance,
  regime: 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF' = 'NEUTRAL'
): EvaluationCriteria {
  const mult = baselineConfig.regimeAdaptation.multipliers[regime];

  return {
    ALPHA: {
      minTStat: 1.96,  // regime 不依存
      maxPValue: 0.05, // regime 不依存
      minIC: baselineConfig.baseline.minIC * mult.ic,
    },
    PERFORMANCE: {
      minSharpe: baselineConfig.baseline.minSharpe * mult.sharpe,
      maxDrawdown: baselineConfig.baseline.maxDrawdown,  // 常に固定
    },
  };
}
```

### 2.3 CqoAgent.auditStrategy() 変更

```typescript
public auditStrategy(
  outcome: StandardOutcome,
  currentRegime?: 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF'
): AuditReport {
  // regime パラメータがなければ StateMonitor から取得
  const regime = currentRegime ?? this.stateMonitor.getCurrentRegime();

  // regime 適応基準を計算
  const crit = LesAgent.computeEffectiveCriteria(
    this.config.pipelineBlueprint.verificationAcceptance,
    regime
  );

  // ← 既存ロジックはそのまま（crit が regime 適応値になった）

  // 監査ログに regime 情報を記録
  const audit: AuditReport = {
    // ... 既存フィールド
    appliedRegime: regime,           // 新フィールド
    appliedThresholds: {             // 新フィールド：参考値
      sharpe: crit.PERFORMANCE.minSharpe,
      ic: crit.ALPHA.minIC,
    },
  };

  return audit;
}
```

### 2.4 bootstrap_baseline.ts（新規ツール）

```typescript
/**
 * ログから baseline を逆算するツール
 *
 * 使用例：
 *   task bootstrap:baseline [--lookback-days 90]
 *   → logs/unified/alpha_discovery_*.json を読み込み
 *   → 採用済み α の Sharpe, IC を集計
 *   → 中央値を baseline として推奨値を提示
 */

export async function bootstrapBaseline(
  lookbackDays: number = 90
): Promise<BaselineReport> {
  // 1. ログファイル読み込み
  const logFiles = await findAlphaDiscoveryLogs(lookbackDays);

  // 2. GO/HOLD ステータスの α のみ抽出
  const adoptedAlphas = extractAdoptedStrategies(logFiles);

  // 3. Sharpe, IC を集計
  const sharpeValues = adoptedAlphas.map(a => a.metrics.sharpeRatio);
  const icValues = adoptedAlphas.map(a => a.alpha.informationCoefficient);

  // 4. 中央値 & percentile 計算
  const sharpeMedian = median(sharpeValues);
  const ic25Percentile = percentile(icValues, 0.25);

  // 5. 推奨 YAML を生成
  const recommendedYaml = `
baseline:
  minSharpe: ${sharpeMedian.toFixed(2)}
  minIC: ${ic25Percentile.toFixed(3)}
  maxDrawdown: 0.1
  minAnnualizedReturn: 0.0
  `;

  return {
    targetAlphasCount: adoptedAlphas.length,
    sharpeStats: { median: sharpeMedian, min, max, q25, q75 },
    icStats: { median, min, max, q25, q75 },
    recommendedYaml,
    analysisDate: new Date().toISOString(),
  };
}
```

---

## 3. Rollout Strategy

### Phase A: Bootstrap（1-2 日）
1. `task bootstrap:baseline` 実行
2. 推奨値を人間がレビュー
3. `config/default.yaml` に統合

### Phase B: Dry-Run（3-5 日）
1. 過去ログに対して「新基準での再審査」を実行
2. 差分を可視化（GO/HOLD/PIVOT の増減など）
3. 人間が「この変化は合理的か」を検証

### Phase C: Live Deployment（翌日）
1. 本番環境に設定をデプロイ
2. `task run:newalphasearch` で新ループ開始
3. ログ監視

### Phase D: Learning & Optimization（3 ヶ月）
1. 毎月ログ集計：regime ごとの成功率を分析
2. 四半期レビュー：マルチプライアー微調整
3. ダッシュボード化

---

## 4. Testing & Validation

### Unit Tests
- ✅ `computeEffectiveCriteria()`: multiplier 計算が正確か
- ✅ Schema validation: YAML が Zod スキーマを満たすか

### Integration Tests
- ✅ Dry-Run ログ比較：過去 90 日のログで「新基準での再審査」実行
- ✅ Regime signal 流通：監査ログに regime 情報が正しく記録されてるか

### Manual Verification
- ✅ Phase B での差分分析：「regime による変化が自然か」を人間が検証

---

## 5. Monitoring & Learning

### Monthly Analysis
```bash
task analyze:regime-performance --month 2026-03
```

出力例：
```
RISK_OFF 期間での採用α：12個
  実績 Sharpe（採用後）: [0.35, 0.42, ..., 0.51]
  中央値: 0.43

現在の multiplier: 0.35 → 実効 Sharpe = 0.35
提案: multiplier を 0.40 に上げる？（採用α の中央値が 0.43 なので）
```

### Quarterly Review
- マルチプライアー最適化提案
- 「新基準の効果」をレポート（取りこぼし削減、等）
- ダッシュボード更新

---

## 6. Risk Mitigation

| リスク | 対策 |
|---|---|
| **基準が緩すぎて悪質な α が通る** | Dry-Run で十分テスト。maxDrawdown は常に厳しく。α-R1（AI推理）との二重判定維持。 |
| **regime 信号が誤り** | StateMonitor の regime 検証は既に運用中。信号に疑問があれば Phase D で multiplier で吸収。 |
| **マルチプライアー値が不適切** | bootstrap で実績ベースに決定。月次学習で改善。人間がレビューして「推奨」で提案（自動適用しない）。 |
| **既存コードへの影響** | `currentRegime` を optional に。regime パラメータなし呼び出しでも動作（デフォルト NEUTRAL）。 |

---

## 7. Success Criteria

✅ **Phase B 完了時**
- Dry-Run で「regime による変化」が可視化される
- 人間が「この基準変更は合理的」と承認

✅ **Phase C: 1 ヶ月後**
- 新基準でループが問題なく回っている
- ログに regime 情報が記録されている

✅ **Phase D: 3 ヶ月後**
- 月次学習が 3 回以上実行
- マルチプライアー最適化提案が出ている
- 「取りこぼし削減」など定量的効果が見える

---

## 8. Open Questions & Next Steps

✅ **すべてのセクションが承認済み**

次のステップ：`superpowers:writing-plans` スキルを呼び出して、詳細な **実装計画** を作成

---

**Design Document End**
