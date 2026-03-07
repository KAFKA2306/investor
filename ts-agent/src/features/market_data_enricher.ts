/**
 * Market Data Enricher
 * Enriches daily market data with macro signals (leverage trend, etc.)
 */

import { LeverageTrendFeatureComputer } from "./leverage_trend_feature.ts";

export interface EnrichedMarketData extends Record<string, number> {
  date?: string;
  macro_leverage_trend?: number;
  [key: string]: unknown;
}

export class MarketDataEnricher {
  private leverageComputer: LeverageTrendFeatureComputer | null = null;
  private leverageCache: Map<string, number | null> = new Map();

  constructor(cacheDbPath?: string) {
    if (cacheDbPath) {
      this.leverageComputer = new LeverageTrendFeatureComputer(cacheDbPath);
    }
  }

  /**
   * Enrich daily bars with macro features
   * - Adds macro_leverage_trend (forward-filled from quarterly OFR data)
   */
  public async enrichBars(
    bars: Record<string, number>[],
    startDate?: string,
    endDate?: string,
  ): Promise<EnrichedMarketData[]> {
    if (!this.leverageComputer || bars.length === 0) {
      // No enrichment if computer not initialized
      return bars as EnrichedMarketData[];
    }

    // Determine date range from bars
    const dates = bars
      .map((b) => b.date as unknown as string)
      .filter((d): d is string => typeof d === "string")
      .sort();

    if (dates.length === 0) {
      return bars as EnrichedMarketData[];
    }

    const from = startDate || dates[0];
    const to = endDate || dates[dates.length - 1];

    // Fetch leverage trend data
    const leverageFeatures = await this.leverageComputer.compute(from, to);

    // Create lookup map
    const leverageMap = new Map<string, number | null>();
    for (const feature of leverageFeatures) {
      leverageMap.set(feature.date, feature.leverage_trend_qtd);
    }

    // Forward-fill leverage trend for daily bars
    let lastValue: number | null = null;
    const enriched: EnrichedMarketData[] = [];

    for (const bar of bars) {
      const date = bar.date as unknown as string;
      const barDate =
        typeof date === "string"
          ? date
          : new Date(bar.timestamp as unknown as number)
              .toISOString()
              .split("T")[0];

      let leverage = leverageMap.get(barDate);
      if (leverage === undefined) {
        leverage = lastValue; // Forward-fill
      }

      lastValue = leverage ?? null;

      enriched.push({
        ...bar,
        macro_leverage_trend: leverage ?? undefined,
      });
    }

    return enriched;
  }

  /**
   * Enrich a single bar (lookup only, no compute)
   */
  public async enrichBar(
    bar: Record<string, number>,
    date?: string,
  ): Promise<EnrichedMarketData> {
    if (!this.leverageComputer) {
      return bar as EnrichedMarketData;
    }

    const barDate = date || (bar.date as unknown as string);
    if (!barDate) {
      return bar as EnrichedMarketData;
    }

    // Check cache first
    if (this.leverageCache.has(barDate)) {
      const leverage = this.leverageCache.get(barDate);
      return {
        ...bar,
        ...(leverage !== null && { macro_leverage_trend: leverage }),
      };
    }

    // Fetch latest leverage data
    const latest = await this.leverageComputer.getLatest();
    const leverage = latest?.leverage_trend_qtd ?? null;

    this.leverageCache.set(barDate, leverage);

    return {
      ...bar,
      ...(leverage !== null && { macro_leverage_trend: leverage }),
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.leverageCache.clear();
  }
}
