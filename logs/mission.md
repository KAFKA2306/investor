# Alpha Discovery Mission: Market Regime: BULL_MOMENTUM, Volatility: CONTRACTING. Existing Seeds: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist). Forbidden: Volatility Regime Hypothesis (Macro Strategist), Adaptive Regime Cross-Signal (gpt-5-nano) Hypothesis (Risk Manager), Regime Transition Hypothesis (Data Scientist), Corporate Governance Hypothesis (Behavioral Economist), Information Asymmetry Hypothesis (Risk Manager), Behavioral Momentum Hypothesis (Quant Analyst), Corporate Governance Hypothesis (Quant Analyst), Information Asymmetry Hypothesis (HFT Engineer), Volatility Regime Hypothesis (Data Scientist). (Cycle 99)

## mission
Market Regime: BULL_MOMENTUM, Volatility: CONTRACTING. Existing Seeds: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist). Forbidden: Volatility Regime Hypothesis (Macro Strategist), Adaptive Regime Cross-Signal (gpt-5-nano) Hypothesis (Risk Manager), Regime Transition Hypothesis (Data Scientist), Corporate Governance Hypothesis (Behavioral Economist), Information Asymmetry Hypothesis (Risk Manager), Behavioral Momentum Hypothesis (Quant Analyst), Corporate Governance Hypothesis (Quant Analyst), Information Asymmetry Hypothesis (HFT Engineer), Volatility Regime Hypothesis (Data Scientist).

### 探索の重点
1. **Regime Neutrality**: 現在の相場レジームに依存しない、頑健なアルファの抽出。
2. **Orthogonality**: 既存のシード（Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core）と相関の低い因子の探索。

## constraints
- ターゲット銘柄: 6501.T, 9501.T, 6701.T
- 禁止領域: Volatility Regime Hypothesis (Macro Strategist), Adaptive Regime Cross-Signal (gpt-5-nano) Hypothesis (Risk Manager), Regime Transition Hypothesis (Data Scientist), Corporate Governance Hypothesis (Behavioral Economist), Information Asymmetry Hypothesis (Risk Manager), Behavioral Momentum Hypothesis (Quant Analyst), Corporate Governance Hypothesis (Quant Analyst), Information Asymmetry Hypothesis (HFT Engineer), Volatility Regime Hypothesis (Data Scientist)
- 納入条件: Sharpe Ratio > 0.35, IC > 0.04

## memory_context
- **シード**: Mean Reversion Seed, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Mean Reversion Core, Liquidity Shock Hypothesis (HFT Engineer), Causal Mechanism (CAMEF) Hypothesis (Behavioral Economist)
- **教訓**: 過去の失敗領域（Volatility Regime Hypothesis (Macro Strategist), Adaptive Regime Cross-Signal (gpt-5-nano) Hypothesis (Risk Manager), Regime Transition Hypothesis (Data Scientist), Corporate Governance Hypothesis (Behavioral Economist), Information Asymmetry Hypothesis (Risk Manager), Behavioral Momentum Hypothesis (Quant Analyst), Corporate Governance Hypothesis (Quant Analyst), Information Asymmetry Hypothesis (HFT Engineer), Volatility Regime Hypothesis (Data Scientist)）を避け、経済的合理性の強い仮説を優先せよ。

## data_contract
- 必須項目: close, operating_profit, capital_expenditure
- 閾値: quality_score > 0.9

## evaluation_contract
- Sharpe Ratio: 0.35
- Information Coefficient: 0.04
- Max Drawdown: < 0.1

## return_path
- DATA_CAUSE: データ作成フェーズへ
- MODEL_CAUSE: モデル選定フェーズへ
