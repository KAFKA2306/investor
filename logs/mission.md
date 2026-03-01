# Alpha Discovery Mission: Market Regime: BULL_MOMENTUM, Volatility: CONTRACTING. Existing Seeds: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist). Forbidden: . (Cycle 24)

## mission
Market Regime: BULL_MOMENTUM, Volatility: CONTRACTING. Existing Seeds: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist). Forbidden: .

### 探索の重点
1. **Regime Neutrality**: 現在の相場レジームに依存しない、頑健なアルファの抽出。
2. **Orthogonality**: 既存のシード（Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core）と相関の低い因子の探索。

## constraints
- ターゲット銘柄: 6501.T, 9501.T, 6701.T
- 禁止領域: Noise-heavy short-term momentum
- 納入条件: Sharpe Ratio > 1.8, IC > 0.04

## memory_context
- **シード**: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist)
- **教訓**: 過去の失敗領域（）を避け、経済的合理性の強い仮説を優先せよ。

## data_contract
- 必須項目: close, operating_profit, capital_expenditure
- 閾値: quality_score > 0.9

## evaluation_contract
- Sharpe Ratio: 1.8
- Information Coefficient: 0.04
- Max Drawdown: < 0.1

## return_path
- DATA_CAUSE: データ作成フェーズへ
- MODEL_CAUSE: モデル選定フェーズへ
