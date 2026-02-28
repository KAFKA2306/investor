import { z } from "zod";
import { YahooFinanceGateway } from "./yahoo_finance_gateway.ts";

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
