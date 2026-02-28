# Investment Committee One-Pager (2026-02-28)

## 1. Decision
- 現時点の判定: **Live配分は見送り（Shadow/Paper継続）**
- 理由:
  - Promotion Gate 判定は `REJECT`（`allocationTier = 0`）
  - 実績サンプル不足（`sampleSize = 3`、要件 `>= 252`）
  - `ledgerQuality`: `missingExposureRows = 3`
  - Full Validation 全体では `PASS 6 / FAIL 3`

## 2. Portfolio Impact
- 即時ポリシー:
  - `sampleSize < 252` は `allocationTier=0`（Live配分ゼロ）
  - Readinessが `READY` 未満なら `Shadow only`
  - 評価は必ず `net-of-cost`（fee/slippage控除後）

## 3. Risk Snapshot
- 主要下方リスク:
  - 短サンプルでの過学習
  - 実行コストの過小評価
  - 約定/エクスポージャ欠損による判定バイアス
- 監視KPI:
  - `Sharpe`, `MaxDD`, `WinRate`, `Turnover`, `CostCoverage`
  - 現在値（candidate, 20260224-20260228）:
  - `cumulativeReturn = -0.449%`
  - `maxDrawdown = -0.449%`
  - `sharpe = 0.0`, `winRate = 0.0`

## 4. What Changed This Week
- `performance-ledger` 契約を新設し、A/B評価を ledger ベースへ統一。
- `promotion gate` を実装し、`allocationTier` と `riskBudgetBps` を機械判定化。
- `run_full_validation` に `Promotion Gate` ステージを追加。

## 5. Promotion Gate (v1)
- Hard Gate:
  - `sampleSize >= 252`
  - Readiness: `READY` かつ score `>= 75`
  - `MaxDD >= -10%`（10%を超える下落は禁止）
  - `Sharpe >= 1.0` で paper、`>= 1.5` で live候補
- 出力:
  - `allocationTier: 0..3`
  - `targetGrossExposureMultiplier`
  - `riskBudgetBps`

## 6. Next 30 Days
- 目標:
  - 日次ログの exposure 欠損ゼロ（`missingExposureRows: 3 -> 0`）
  - 252営業日サンプル達成に向けたデータ拡張
  - Promotion Gate の履歴を週次レビューに組み込み
- 成功条件:
  - 再現可能な net-of-cost 実績で、委員会判断が毎週同じルールで可能になること
  - `allocationTier >= 1`（Paper Allocation）へ昇格可能な証跡が揃うこと
