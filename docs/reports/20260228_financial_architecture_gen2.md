# Financial Architecture Gen2 Review (2026-02-28)

## 0. Executive Verdict
- 現状は「研究環境としては有望、運用配分としては時期尚早」。
- 根拠: readiness は `CAUTION`、サンプルは `3`、日次実績は `PASS 2 / FAIL 3`（2026-02系5本）。
- したがって次世代設計の主軸は、**コード整理ではなく資本配分の再現性**に置く。

---

## 1. Evidence Snapshot (as-is)

### A. Readiness is below production bar
- `logs/readiness/20260227.json`  
  - `sampleSize: 3`
  - `score.total: 67`
  - `thresholds.productionReadyMin: 75`
  - `verdict: "CAUTION"`

### B. Daily operating outcomes are unstable
- 2026-02系の日次ログ5本（`20260222/23/24/25/27`）集計:
  - `PASS: 2`, `FAIL: 3`
  - `EXECUTED: 1`, `SKIPPED: 4`
  - `median net return: -0.0015`
- 代表例:
  - `logs/daily/20260223.json`: `status=PASS`, `netReturn=0.002158753...`, `execution=EXECUTED`
  - `logs/daily/20260224.json`: `status=FAIL`, `netReturn=-0.0015`, `workflow=USELESS`
  - `logs/daily/20260227.json`: `status=FAIL`, `cagr=-0.0270`, `maxDrawdown=-0.001498...`

### C. Some outcome logs look template-like rather than audited P/L
- `logs/unified/2026-02-24.json` と `logs/unified/2026-02-27.json` は
  `mae/rmse/smape/directionalAccuracy = 0` の固定パターンを含む。
- 投資委員会向けの「実績監査ログ」としては、実運用の fill/cost/slippage と接続した証跡が不足。

---

## 2. Gen2 Target State (financial-first)

### Principle 1: Research and Capital must be separated
- `Research`: 仮説探索、特徴量探索、実験的モデル。
- `Capital`: 既定ゲート通過済み戦略のみを配分対象にする。
- 実装上は「同じコードベース」でも、**昇格契約（promotion contract）**で明確分離。

### Principle 2: PASS/FAIL ではなく position sizing
- 出力は `USEFUL/USELESS` ではなく `targetGrossExposure` と `riskBudgetBps`。
- 例:
  - Gate未達: `targetGrossExposure=0`
  - Gate境界: `targetGrossExposure=0.25x`
  - Gate十分超過: `targetGrossExposure=1.0x`

### Principle 3: One source of truth for performance
- すべての評価は `net-of-cost`（手数料・スリッページ控除後）で統一。
- 同一指標セット:
  - `CAGR`, `Sharpe`, `Sortino`, `MaxDD`, `HitRate`, `Turnover`, `Capacity`, `PBO proxy`

---

## 3. Promotion Gate v1 (hard rules)

### 3.1 Minimum data requirements
- `sampleSize >= 252` 営業日（理想は `756`）。
- 欠損率、価格更新遅延、約定ログ整合性の基準を満たすこと。

### 3.2 Performance requirements (net-of-cost)
- `Sharpe >= 1.0`（初期）、本配分は `>= 1.5`
- `MaxDD <= 10%`
- `HitRate >= 50%` を参考指標（単独採用しない）
- `Turnover` と `slippage sensitivity` が許容域

### 3.3 Stability requirements
- ローリング窓での Sharpe 崩壊が閾値以内
- ブートストラップ/サブサンプルで符号反転しない
- regime分割（上昇/下落/高ボラ）で破綻しない

### 3.4 Governance requirements
- モデル・パラメータ・データバージョンの追跡可能性100%
- 手動override時は理由と期限を必須記録

---

## 4. Reference Architecture (Gen2)

```text
Research Layer
  factor_mining / experiments / scenario notebooks
        |
        v  (promotion contract)
Validation Layer
  walk-forward + cost model + capacity checks
        |
        v  (allocation decision)
Capital Layer
  sizing engine + risk budget + kill switch
        |
        v
Execution Layer
  paper/live adapters + post-trade reconciliation
        |
        v
Performance Ledger
  immutable daily pnl + exposures + attribution
```

---

## 5. Implementation Order (PR-ready)

### PR-1: Canonical Performance Ledger
- 追加:
  - `contracts/performance_ledger.ts`
  - `pipeline/evaluate/performance_metrics.ts` を ledger準拠へ統一
- 完了条件:
  - 日次ログ全てで `netReturn`, `cost`, `exposure`, `drawdown` が欠損なし

### PR-2: Promotion Gate Service
- 追加:
  - `application/promotion_gate.ts`
  - Gate判定を `PASS/FAIL` ではなく `allocationTier` で返す
- 完了条件:
  - `sampleSize` 不足時に必ず `allocationTier=0`

### PR-3: Capital Allocation Engine
- 追加:
  - `application/capital_allocator.ts`
  - `kellyFraction` を上限制約付きの実配分へ変換
- 完了条件:
  - 配分は `riskBudgetBps` に必ず収まる

### PR-4: Execution Reconciliation
- 追加:
  - 約定後の `expected vs realized` 差分ログ
- 完了条件:
  - 乖離閾値超過で自動 `de-risk` 発火

### PR-5: Kill Switch and Drawdown Guard
- 追加:
  - 日次/週次DD閾値で `exposure clamp`
- 完了条件:
  - 閾値超過時に翌セッション配分が強制的に縮小

### PR-6: Investment Committee Report Pack
- 追加:
  - `logs/ic/` 向けの固定フォーマット出力（A4 1-2枚想定）
- 完了条件:
  - すべての戦略が同一テンプレートで比較可能

---

## 6. 30/60/90-Day Plan

### Day 0-30
- PR-1, PR-2 を完了
- 目的: 「何が儲かったか」ではなく「どう測るか」を固定

### Day 31-60
- PR-3, PR-4 を完了
- 目的: 研究結果を資本配分へ安全に変換

### Day 61-90
- PR-5, PR-6 を完了
- 目的: 下方リスク管理と説明責任を運用レベルへ

---

## 7. Immediate Policy (effective now)
- `readiness verdict != PRODUCTION_READY` の間は `live allocation = 0`
- `sampleSize < 252` の戦略は paper/shadow のみ
- 投資判断は必ず `net-of-cost` 指標を優先し、`alphaScore` 単独判断を禁止

---

## 8. Closing
- このGen2は「設計の美しさ」ではなく、**誤配分を減らし、再現可能に勝つ**ための設計。
- 最短価値は PR-1/2 の2本。ここを固めるだけで、運用判断の質は一段上がる。
