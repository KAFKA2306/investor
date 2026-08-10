/**
 * OFR Hedge Fund Monitor API Provider
 * SEC Form PF aggregated statistics from Office of Financial Research
 *
 * API: https://data.financialresearch.gov/hf/v1
 * No API key required (public data)
 */

import { SqliteHttpCache } from "./cache_providers.ts";
import { requestJson } from "./http_json_client.ts";

export interface HedgeFundLeverageData {
  date: string;
  leverage_all: number | null;
  leverage_top10: number | null;
  leverage_mid: number | null;
  leverage_small: number | null;
  timestamp: string;
}

export interface HedgeFundMetrics {
  date: string;
  gav_sum: number | null;
  nav_sum: number | null;
  gne_sum: number | null;
  count: number | null;
  timestamp: string;
}

export class OfrHfmProvider {
  private readonly baseUrl = "https://data.financialresearch.gov/hf/v1";
  private readonly cache: SqliteHttpCache;
  private readonly cacheTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(cachePath: string) {
    this.cache = new SqliteHttpCache(cachePath);
  }

  public async getLeverageData(
    startDate: string,
    endDate?: string,
  ): Promise<HedgeFundLeverageData[]> {
    const mnemonics = [
      "FPF-ALLQHF_GAVN10_LEVERAGERATIO_AVERAGE",
      "FPF-ALLQHF_GAVN11TO50_LEVERAGERATIO_AVERAGE",
      "FPF-ALLQHF_GAVN51_LEVERAGERATIO_AVERAGE",
    ];

    const results: Map<string, HedgeFundLeverageData> = new Map();
    for (const mnemonic of mnemonics) {
      const series = await this.getTimeseries(mnemonic, startDate, endDate);
      for (const [date, value] of series) {
        if (!results.has(date)) {
          results.set(date, {
            date,
            leverage_all: null,
            leverage_top10: null,
            leverage_mid: null,
            leverage_small: null,
            timestamp: new Date().toISOString(),
          });
        }
        const record = results.get(date)!;
        if (mnemonic.includes("GAVN10")) record.leverage_top10 = value;
        else if (mnemonic.includes("GAVN11TO50")) record.leverage_mid = value;
        else if (mnemonic.includes("GAVN51")) record.leverage_small = value;
      }
    }

    for (const record of results.values()) {
      if (record.leverage_all === null) record.leverage_all = record.leverage_top10;
    }
    return Array.from(results.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  public async getMetricsData(
    startDate: string,
    endDate?: string,
  ): Promise<HedgeFundMetrics[]> {
    const mnemonics = [
      { key: "gav_sum", mnem: "FPF-ALLQHF_GAV_SUM" },
      { key: "nav_sum", mnem: "FPF-ALLQHF_NAV_SUM" },
      { key: "gne_sum", mnem: "FPF-ALLQHF_GNE_SUM" },
      { key: "count", mnem: "FPF-ALLQHF_COUNT" },
    ];
    const results: Map<string, HedgeFundMetrics> = new Map();
    for (const { key, mnem } of mnemonics) {
      const series = await this.getTimeseries(mnem, startDate, endDate);
      for (const [date, value] of series) {
        if (!results.has(date)) {
          results.set(date, {
            date,
            gav_sum: null,
            nav_sum: null,
            gne_sum: null,
            count: null,
            timestamp: new Date().toISOString(),
          });
        }
        const record = results.get(date)!;
        record[key as keyof HedgeFundMetrics] = value as never;
      }
    }
    return Array.from(results.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  public calculateLeverageTrend(data: HedgeFundLeverageData[]): {
    date: string;
    trend_overall: number | null;
    trend_top10: number | null;
    trend_mid: number | null;
  }[] {
    const trends = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const calcTrend = (current: number | null, previous: number | null) => {
        if (current === null || previous === null || previous === 0) return null;
        return ((current - previous) / previous) * 100;
      };
      trends.push({
        date: curr.date,
        trend_overall: calcTrend(curr.leverage_all, prev.leverage_all),
        trend_top10: calcTrend(curr.leverage_top10, prev.leverage_top10),
        trend_mid: calcTrend(curr.leverage_mid, prev.leverage_mid),
      });
    }
    return trends;
  }

  public classifyRiskRegime(
    leverageRatio: number | null,
  ): "LOW" | "MEDIUM" | "HIGH" {
    if (leverageRatio === null) return "MEDIUM";
    if (leverageRatio < 10) return "LOW";
    if (leverageRatio > 15) return "HIGH";
    return "MEDIUM";
  }

  private async getTimeseries(
    mnemonic: string,
    startDate: string,
    endDate?: string,
  ): Promise<[string, number | null][]> {
    try {
      const res = await requestJson({
        baseUrl: this.baseUrl,
        endpoint: "/series/timeseries",
        query: {
          mnemonic,
          start_date: startDate,
          ...(endDate && { end_date: endDate }),
        },
        cache: this.cache,
        ttlMs: this.cacheTtlMs,
      });
      if (!Array.isArray(res.payload)) return [];
      return res.payload as [string, number | null][];
    } catch (error) {
      console.error(`⚠️ [OFR HFM] Failed to fetch ${mnemonic}: ${error}`);
      return [];
    }
  }
}
