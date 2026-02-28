import { join } from "node:path";
import { z } from "zod";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./sqlite_http_response_cache.ts";

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

export const YFinanceQuoteSnapshotSchema = z.object({
  symbol: z.string().min(1),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  marketCap: z.number(),
  trailingPE: z.number(),
});

export type YFinanceQuoteSnapshot = z.infer<typeof YFinanceQuoteSnapshotSchema>;

const toNumber = (v: unknown): number =>
  z
    .union([z.number(), z.string()])
    .transform((x) => Number(x))
    .pipe(z.number().finite())
    .catch(0)
    .parse(v);

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

    if (!payload) throw new Error(`Fetch failed for ${symbol} quoteSummary`);
    const raw = (
      payload as { quoteSummary?: { result?: Array<Record<string, unknown>> } }
    ).quoteSummary?.result?.[0];
    if (!raw) throw new Error(`No summary for ${symbol}`);

    return z
      .record(
        z.string(),
        z.union([z.any(), z.number(), z.string(), z.boolean(), z.null()]),
      )
      .parse(raw);
  }

  public async getStockInfo(
    symbol: string,
  ): Promise<Record<string, unknown> | undefined> {
    const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    url.searchParams.set("symbols", symbol);
    const payload = await this.cache.fetchJson(
      url.toString(),
      {},
      5 * 60 * 1000,
    );
    const rows = (
      payload as {
        quoteResponse?: { result?: Array<Record<string, unknown>> };
      }
    ).quoteResponse?.result;
    return rows?.[0];
  }
}

export class YFinanceProvider {
  private readonly yahoo = new YahooFinanceGateway();

  public async getStockInfo(
    ticker: string,
  ): Promise<Record<string, unknown> | undefined> {
    return this.yahoo.getStockInfo(ticker);
  }

  public async getQuoteSnapshot(
    ticker: string,
  ): Promise<YFinanceQuoteSnapshot> {
    const row = z
      .record(z.string(), z.unknown())
      .catch({})
      .parse(await this.getStockInfo(ticker));
    return YFinanceQuoteSnapshotSchema.parse({
      symbol: z.string().catch(ticker).parse(row.symbol),
      open: toNumber(row.regularMarketOpen),
      high: toNumber(row.regularMarketDayHigh),
      low: toNumber(row.regularMarketDayLow),
      close: toNumber(row.regularMarketPrice),
      volume: toNumber(row.regularMarketVolume),
      marketCap: toNumber(row.marketCap),
      trailingPE: toNumber(row.trailingPE),
    });
  }
}
