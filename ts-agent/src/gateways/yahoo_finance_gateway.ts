import { join } from "node:path";
import { z } from "zod";
import { core } from "../core/index.ts";
import { SqliteHttpCache } from "../data_cache/sqlite_http_cache.ts";

export interface YahooBar {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

interface ChartResult {
  timestamp: (number | null)[];
  indicators: {
    quote: {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }[];
  };
}

interface QuoteResult {
  quoteSummary: {
    result: Record<string, number | string | boolean | null>[];
  };
}

export class YahooFinanceGateway {
  private readonly cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "yahoo_finance_cache.sqlite"),
  );

  public async getChart(symbol: string, range = "2y"): Promise<YahooBar[]> {
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

    const resRaw = (payload as unknown as { chart: { result: ChartResult[] } })
      .chart.result[0];
    if (!resRaw) throw new Error(`No data for ${symbol}`);

    const timestamps = z.array(z.number().nullable()).parse(resRaw.timestamp);
    const quote = resRaw.indicators.quote[0];
    if (!quote) throw new Error(`No quote data for ${symbol}`);

    const opens = z.array(z.number().nullable()).parse(quote.open);
    const highs = z.array(z.number().nullable()).parse(quote.high);
    const lows = z.array(z.number().nullable()).parse(quote.low);
    const closes = z.array(z.number().nullable()).parse(quote.close);
    const volumes = z.array(z.number().nullable()).parse(quote.volume);

    const bars: YahooBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const close = closes[i];

      if (
        typeof ts === "number" &&
        open !== null &&
        open !== undefined &&
        close !== null &&
        close !== undefined
      ) {
        const barDate = new Date(ts * 1000).toISOString().split("T")[0];
        if (!barDate) continue;

        bars.push({
          Date: barDate,
          Open: open,
          High: highs[i] ?? close,
          Low: lows[i] ?? close,
          Close: close,
          Volume: volumes[i] ?? 0,
        });
      }
    }
    return bars;
  }

  public async getQuoteSummary(
    symbol: string,
  ): Promise<Record<string, number | string | boolean | null>> {
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

    const raw = (payload as unknown as QuoteResult).quoteSummary.result[0];
    if (!raw) throw new Error(`No summary for ${symbol}`);
    return z
      .record(
        z.string(),
        z.union([z.number(), z.string(), z.boolean(), z.null()]),
      )
      .parse(raw);
  }
}
