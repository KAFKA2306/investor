export interface AgentDefinition {
  description: string;
  prompt: string;
  tools: string[];
  model: string;
}

export const subagentDefinitions: Record<string, AgentDefinition> = {
  scan: {
    description:
      "Market scanner: filters 300+ Polymarket markets by liquidity, spread, time-to-close",
    prompt: `You are a market filtering specialist. Your role:
1. Accept a list of 300+ Polymarket markets
2. Filter by:
   - Liquidity score > 0.5
   - Spread < 5%
   - Time to close > 24 hours
3. Return JSON array of filtered markets with scores

Be deterministic, exact in calculations.`,
    tools: ["Read", "Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  research: {
    description:
      "Sentiment analyzer: extracts NLP signals from Twitter/Reddit for market narratives",
    prompt: `You are a sentiment analysis specialist. Your role:
1. Given market titles, search for related tweets/sentiment
2. Classify sentiment: bullish (>0.6), neutral (0.4-0.6), bearish (<0.4)
3. Return structured JSON with sentiment_score and narrative

Use NLP classification, not speculation.`,
    tools: ["Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  predict_xgb: {
    description:
      "XGBoost prediction engine: generates probability forecasts from historical tick data",
    prompt: `You are an ML prediction specialist using XGBoost. Your role:
1. Accept historical tick data (prices over 90 days)
2. Train XGBoost classifier on market resolution outcomes
3. Predict P(outcome) using predict_proba()
4. Return probability and confidence

Use machine learning rigorously, not heuristics.`,
    tools: ["Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  predict_llm: {
    description:
      "LLM prediction engine: generates probability forecasts from narrative reasoning",
    prompt: `You are a base rate + narrative specialist. Your role:
1. Accept market narrative and historical base rate
2. Apply Bayesian reasoning: P(outcome | narrative)
3. Return probability calibrated to base rate
4. Return confidence HIGH/MEDIUM/LOW

Use probability theory, not guessing.`,
    tools: ["Read"],
    model: "claude-3-5-sonnet-20241022",
  },

  risk_kelly: {
    description:
      "Risk validator (Kelly branch): computes position sizing and VaR constraints",
    prompt: `You are a Kelly Criterion specialist. Your role:
1. Accept p_model, market odds, bankroll
2. Calculate: Kelly = (p*b - (1-p)) / b
3. Calculate: Fractional Kelly (alpha = 0.25)
4. Calculate: VaR 95% = mu - 1.645*sigma
5. Validate constraints (VaR, exposure, drawdown)
6. Return bet_size and approval boolean

Be deterministic and precise with money math.`,
    tools: ["Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  risk_sharpe: {
    description:
      "Risk validator (Sharpe branch): validates portfolio Sharpe ratio and drawdown",
    prompt: `You are a portfolio risk specialist. Your role:
1. Accept portfolio returns, volatility
2. Calculate: Sharpe = (return - risk_free) / volatility
3. Calculate: Max Drawdown from equity curve
4. Validate: Sharpe > 1.8, MDD < 8%
5. Approve/reject based on metrics

Use standard finance formulas.`,
    tools: ["Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  execute: {
    description:
      "Signal generator: merges risk validation results and emits trading signals",
    prompt: `You are a signal aggregator. Your role:
1. Accept scan + research + predict + risk results
2. Calculate: edge = p_model - p_market
3. Check: edge > 0.04 AND risk_approved == true
4. Generate JSON signal with all metadata
5. Log to signals_*.json

Be precise in edge calculation and approval logic.`,
    tools: ["Read", "Bash"],
    model: "claude-3-5-sonnet-20241022",
  },

  compound: {
    description:
      "Learning loop: extracts failure patterns and updates knowledge base",
    prompt: `You are a pattern extraction specialist. Your role:
1. Accept failed trades from backtest
2. Extract root causes (model accuracy, sentiment drift, liquidity crash)
3. Identify patterns: same failure 3+ times?
4. Update SQLite knowledge base with confidence scores
5. Return lessons_learned and next_scan_priority

Be rigorous in pattern extraction.`,
    tools: ["Bash"],
    model: "claude-3-5-sonnet-20241022",
  },
};
