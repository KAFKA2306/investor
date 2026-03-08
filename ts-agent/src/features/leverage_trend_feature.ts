/**
 * Macro Leverage Trend Feature
 * Computes hedge fund industry leverage trend as a market risk regime indicator
 */

import { OfrHfmProvider } from "../providers/ofr_hfm_provider.ts";

export interface LeverageTrendFeature {
  date: string;
  leverage_level: number | null; // Absolute leverage (e.g., 15.2x)
  leverage_trend_qtd: number | null; // QoQ change percentage
  leverage_regime: "LOW" | "MEDIUM" | "HIGH"; // Risk regime classification
  leverage_size_spread: number | null; // Top10 - Mid size spread
  has_deleveraging: boolean; // True if trend_qtd < -1%
}

export class LeverageTrendFeatureComputer {
  private readonly provider: OfrHfmProvider;
  private cache: Map<string, LeverageTrendFeature[]> = new Map();

  constructor(cacheDbPath: string) {
    this.provider = new OfrHfmProvider(cacheDbPath);
  }

  /**
   * Compute leverage trend features for a date range
   */
  public async compute(
    startDate: string,
    endDate: string,
  ): Promise<LeverageTrendFeature[]> {
    const cacheKey = `${startDate}_${endDate}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const leverageData = await this.provider.getLeverageData(
      startDate,
      endDate,
    );
    const trends = this.provider.calculateLeverageTrend(leverageData);

    const features: LeverageTrendFeature[] = [];

    for (let i = 0; i < leverageData.length; i++) {
      const data = leverageData[i];
      const trend = trends[i - 1]; // trend is offset by 1

      features.push({
        date: data.date,
        leverage_level: data.leverage_all,
        leverage_trend_qtd: trend?.trend_overall ?? null,
        leverage_regime: this.provider.classifyRiskRegime(data.leverage_all),
        leverage_size_spread:
          data.leverage_top10 && data.leverage_mid
            ? data.leverage_top10 - data.leverage_mid
            : null,
        has_deleveraging: (trend?.trend_overall ?? 0) < -1,
      });
    }

    this.cache.set(cacheKey, features);
    return features;
  }

  /**
   * Get the most recent leverage trend feature
   */
  public async getLatest(): Promise<LeverageTrendFeature | null> {
    const today = new Date().toISOString().split("T")[0];
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const features = await this.compute(twoYearsAgo, today);
    return features.length > 0 ? features[features.length - 1] : null;
  }

  /**
   * Get leverage regime context string for LES agent prompts
   */
  public async getRiskRegimeContext(): Promise<string> {
    const latest = await this.getLatest();
    if (!latest) return "Risk regime: unknown (data unavailable)";

    let context = `Risk regime: ${latest.leverage_regime} (leverage=${latest.leverage_level?.toFixed(2)}x)`;

    if (latest.has_deleveraging) {
      context +=
        " - Industry delevering (good for tail risk reduction, may compress spreads)";
    } else if (latest.leverage_trend_qtd && latest.leverage_trend_qtd > 0) {
      context += ` - Increasing leverage (+${latest.leverage_trend_qtd.toFixed(1)}% QoQ, risk building)`;
    }

    if (latest.leverage_size_spread) {
      context += ` - Size disparity: ${latest.leverage_size_spread.toFixed(2)}x (top10 > mid)`;
    }

    return context;
  }
}
