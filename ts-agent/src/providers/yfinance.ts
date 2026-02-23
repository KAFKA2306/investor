import { z } from "zod";
import { SqliteHttpCache } from "../experiments/cache/sqlite_http_cache.ts";

const QuoteResponseSchema = z.object({
  quoteResponse: z.object({
    result: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

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

export class YFinanceProvider {
  private readonly cache = new SqliteHttpCache(
    `${process.cwd()}/../logs/cache/market_cache.sqlite`,
  );

  public async getStockInfo(
    ticker: string,
  ): Promise<Record<string, unknown> | undefined> {
    const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    url.searchParams.set("symbols", ticker);
    const data = QuoteResponseSchema.catch({
      quoteResponse: { result: [] },
    }).parse(await this.cache.fetchJson(url.toString(), {}, 5 * 60 * 1000));
    return data.quoteResponse.result[0];
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
