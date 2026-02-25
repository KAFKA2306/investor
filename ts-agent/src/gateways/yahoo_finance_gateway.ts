import { join } from "node:path";
import { z } from "zod";
import { core } from "../core/index.ts";
import { SqliteHttpCache } from "../data_cache/sqlite_http_cache.ts";

export class YahooFinanceGateway {
  private readonly cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "yahoo_finance_cache.sqlite"),
  );

  /**
   * Fetches daily OHLC history.
   * @param symbol Ticker symbol (e.g., "NVDA")
   * @param range Lookback range (e.g., "2y")
   */
  public async getChart(
    symbol: string,
    range = "2y",
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
    );
    url.searchParams.set("interval", "1d");
    url.searchParams.set("range", range);

    const payload = await this.cache.fetchJson(
      url.toString(),
      {},
      24 * 60 * 60 * 1000,
    );

    const result = z.any().parse(payload).chart.result[0];
    const timestamps = z.array(z.number()).parse(result.timestamp);
    const quote = result.indicators.quote[0];

    const opens = z.array(z.number().nullable()).parse(quote.open);
    const highs = z.array(z.number().nullable()).parse(quote.high);
    const lows = z.array(z.number().nullable()).parse(quote.low);
    const closes = z.array(z.number().nullable()).parse(quote.close);
    const volumes = z.array(z.number().nullable()).parse(quote.volume);

    const bars: Record<string, unknown>[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const close = closes[i];
      const high = highs[i];
      const low = lows[i];
      const volume = volumes[i];
      if (ts !== undefined && open !== null && close !== null) {
        bars.push({
          Date: new Date(ts * 1000).toISOString().split("T")[0],
          Open: open,
          High: high ?? close,
          Low: low ?? close,
          Close: close,
          Volume: volume ?? 0,
        });
      }
    }
    return bars;
  }

  /**
   * Fetches fundamental info such as PE Ratio and Earnings dates.
   * @param symbol Ticker symbol (e.g., "NVDA")
   */
  public async getQuoteSummary(
    symbol: string,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`,
    );
    url.searchParams.set(
      "modules",
      "summaryDetail,defaultKeyStatistics,calendarEvents",
    );

    const payload = await this.cache.fetchJson(
      url.toString(),
      {},
      24 * 60 * 60 * 1000,
    );

    return z.any().parse(payload).quoteSummary.result[0];
  }
}
