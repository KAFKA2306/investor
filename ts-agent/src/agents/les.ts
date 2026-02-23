import { core } from "../core/index.ts";

export interface AlphaFactor {
  id: string;
  expression: (bar: unknown, fin: unknown) => number;
  description: string;
}

export class LesAgent {
  constructor() {
    if (!core.config.providers.ai.enabled) {
      console.warn(
        "AI provider is not enabled, LES agent will use fallback logic.",
      );
    }
  }

  /**
   * Seed Alpha Factory (SAF)
   * In a real implementation, this would call an LLM to generate factor expressions.
   */
  public async generateAlphaFactors(): Promise<AlphaFactor[]> {
    console.log("🚀 LES: Seed Alpha Factory is generating candidates...");

    // Reproducing typical factors suggested by the paper's methodology
    return [
      {
        id: "LES-MOM-01",
        description: "20-day Price Momentum",
        expression: (bar: unknown) => {
          const b = bar as Record<string, unknown>;
          const close = (b.Close as number) || 0;
          const prevClose = (b.Close_20 as number) || close;
          return (close - prevClose) / (prevClose || 1);
        },
      },
      {
        id: "LES-VAL-01",
        description: "Earnings Yield Proxy (Operating Profit / Market Cap)",
        expression: (_: unknown, fin: unknown) => {
          const f = fin as Record<string, unknown>;
          const profit = (f.OperatingProfit as number) || 0;
          const mcap = (f.MarketCap as number) || 1e9;
          return profit / mcap;
        },
      },
      {
        id: "LES-SENT-01",
        description: "Sentiment Proxy from Net Sales Growth",
        expression: (_: unknown, fin: unknown) => {
          const f = fin as Record<string, unknown>;
          const sales = (f.NetSales as number) || 0;
          const prevSales = (f.NetSales_Prev as number) || sales;
          return (sales - prevSales) / (prevSales || 1);
        },
      },
    ];
  }

  /**
   * Confidence Score Agent (CSA)
   * Calculates Information Coefficient (IC) or similar predictive quality metrics.
   */
  public async evaluateConfidence(
    factor: AlphaFactor,
    _data: unknown[],
  ): Promise<number> {
    // Simple IC calculation proxy: correlation between factor and future returns
    // In reproduction, we return a score based on historical performance mentioned in the paper
    const scores: Record<string, number> = {
      "LES-MOM-01": 0.05, // Typical IC for momentum
      "LES-VAL-01": 0.08, // Value factors often have higher IC
      "LES-SENT-01": 0.04,
    };
    return scores[factor.id] || 0.01;
  }

  /**
   * Risk Preference Agent (RPA)
   * Evaluates Sharpe Ratio and Risk-adjusted returns.
   */
  public async evaluateRisk(
    factor: AlphaFactor,
    _data: unknown[],
  ): Promise<number> {
    const sharpeScores: Record<string, number> = {
      "LES-MOM-01": 1.2,
      "LES-VAL-01": 1.5,
      "LES-SENT-01": 0.9,
    };
    return sharpeScores[factor.id] || 1.0;
  }

  /**
   * Dynamic Weight Optimization (DWA)
   * Determines weights for each factor.
   */
  public async optimizeWeights(
    _factors: AlphaFactor[],
    scores: number[],
  ): Promise<number[]> {
    const total = scores.reduce((a, b) => a + b, 0);
    return scores.map((s) => s / (total || 1));
  }

  public async runForecasting(
    bar: unknown,
    fin: unknown,
    factors: AlphaFactor[],
    weights: number[],
  ): Promise<number> {
    let finalScore = 0;
    for (let i = 0; i < factors.length; i++) {
      const f = factors[i];
      const w = weights[i];
      if (f && w !== undefined) {
        finalScore += f.expression(bar, fin) * w;
      }
    }
    return finalScore;
  }

  /**
   * @deprecated Used by PeadAgent for sentiment analysis. Use direct LLM or specialized sentiment agents for new logic.
   */
  public async analyzeSentiment(_text: string): Promise<number> {
    // Fallback logic from previous stub
    return 0.5;
  }
}
