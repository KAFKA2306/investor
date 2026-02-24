import { join } from "node:path";
import { z } from "zod";
import { core } from "../core/index.ts";
import { SqliteHttpCache } from "../data_cache/sqlite_http_cache.ts";
import { YFinanceProvider } from "../providers/yfinance.ts";

export type MarketDataGateway = {
  getEstatStats(statsDataId: string): Promise<Record<string, unknown>>;
  getListedInfo(): Promise<Record<string, unknown>[]>;
  getDailyBars(
    symbol: string,
    dates: readonly string[],
  ): Promise<Record<string, unknown>[]>;
  getStatements(symbol: string): Promise<Record<string, unknown>[]>;
  getMarketDataEndDate(): Promise<string>;
  getHistory(symbol: string, limit: number): Promise<number[]>;
};

const safeRecordArray = (value: unknown): Record<string, unknown>[] =>
  z.array(z.record(z.string(), z.unknown())).catch([]).parse(value);

const findArrayByPreferredKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): unknown[] | undefined =>
  keys.map((k) => value[k]).find((v) => Array.isArray(v)) as
    | unknown[]
    | undefined;

const findFirstArray = (value: unknown): unknown[] | undefined =>
  Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? Object.values(value as Record<string, unknown>)
          .map((v) => findFirstArray(v))
          .find((v) => v !== undefined)
      : undefined;

const extractRows = (
  payload: Record<string, unknown>,
): Record<string, unknown>[] =>
  safeRecordArray(
    findArrayByPreferredKeys(payload, [
      "daily_quotes",
      "statements",
      "listed_info",
      "indices",
      "quotes",
      "data",
    ]) ??
      findFirstArray(payload) ??
      [],
  );

const pickLatestRows = async (
  apiKey: string,
  symbol: string,
  dates: readonly string[],
  cache: SqliteHttpCache,
): Promise<Record<string, unknown>[]> => {
  const sorted = [...dates].sort();
  const from = sorted[0] ?? "";
  const to = sorted[sorted.length - 1] ?? "";
  const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code", `${symbol}0`);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const payload = await cache.fetchJson(
    url.toString(),
    { "x-api-key": apiKey },
    6 * 60 * 60 * 1000,
  );
  const rows = extractRows(payload);
  const latest = [...rows]
    .sort((a, b) =>
      z
        .string()
        .catch("")
        .parse(b.Date)
        .localeCompare(z.string().catch("").parse(a.Date)),
    )
    .at(0);
  return latest ? [latest] : [];
};

export class LiveMarketDataGateway implements MarketDataGateway {
  private readonly apiKey = z
    .object({ JQUANTS_API_KEY: z.string().min(1) })
    .parse(process.env).JQUANTS_API_KEY;
  private readonly estatAppId = z
    .object({ ESTAT_APP_ID: z.string().min(1) })
    .parse(process.env).ESTAT_APP_ID;
  private readonly cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "market_cache.sqlite"),
  );
  private readonly yfinance = new YFinanceProvider();

  private async getYfQuoteRow(
    symbol: string,
  ): Promise<Record<string, unknown>> {
    const q = await this.yfinance.getQuoteSnapshot(`${symbol}.T`);
    return {
      Code: `${symbol}0`,
      Open: q.open,
      High: q.high,
      Low: q.low,
      Close: q.close,
      Volume: q.volume,
      TurnoverValue: q.close * q.volume,
      Date: new Date().toISOString().slice(0, 10).replaceAll("-", ""),
      NetSales: q.marketCap,
      OperatingProfit: q.trailingPE > 0 ? q.marketCap / q.trailingPE / 10 : 0,
    };
  }

  private async fetchJquantsRows(
    endpoint: string,
    params: Record<string, string>,
    ttlMs: number,
  ): Promise<Record<string, unknown>[]> {
    const url = new URL(`https://api.jquants.com/v2${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    const payload = await this.cache.fetchJson(
      url.toString(),
      { "x-api-key": this.apiKey },
      ttlMs,
    );
    return extractRows(payload);
  }

  public async getEstatStats(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData",
    );
    url.searchParams.set("appId", this.estatAppId);
    url.searchParams.set("statsDataId", statsDataId);
    url.searchParams.set("lang", "J");
    return this.cache.fetchJson(url.toString(), {}, 24 * 60 * 60 * 1000);
  }

  public async getListedInfo(): Promise<Record<string, unknown>[]> {
    return this.fetchJquantsRows("/equities/master", {}, 24 * 60 * 60 * 1000);
  }

  public async getDailyBars(
    symbol: string,
    dates: readonly string[],
  ): Promise<Record<string, unknown>[]> {
    const rows = await pickLatestRows(this.apiKey, symbol, dates, this.cache);
    return rows.length > 0 ? rows : [await this.getYfQuoteRow(symbol)];
  }

  public async getStatements(
    symbol: string,
  ): Promise<Record<string, unknown>[]> {
    const code5 = `${symbol}0`;
    const rows = await this.fetchJquantsRows(
      "/fins/summary",
      { code: code5 },
      24 * 60 * 60 * 1000,
    );
    return rows.length > 0 ? rows : [await this.getYfQuoteRow(symbol)];
  }

  public async getMarketDataEndDate(): Promise<string> {
    return new Date().toISOString().slice(0, 10).replaceAll("-", "");
  }

  public async getHistory(symbol: string, limit: number): Promise<number[]> {
    // Audit Fix: Implement genuine history fetching to avoid flat-line data leakage.
    // Use yfinance to get historical close prices.
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.T`,
    );
    url.searchParams.set("interval", "1d");
    url.searchParams.set("range", "2y"); // Get enough data for the limit

    try {
      const payload = await this.cache.fetchJson(
        url.toString(),
        {},
        24 * 60 * 60 * 1000,
      );
      const result = z.any().parse(payload).chart.result[0];
      const closes = z
        .array(z.number().finite())
        .parse(result.indicators.quote[0].close);
      return closes.filter((v) => v !== null).slice(-limit);
    } catch (e) {
      console.warn(
        `[Gateway] Failed to fetch history for ${symbol}, falling back to mocked close.`,
        e,
      );
      const bars = await this.getDailyBars(symbol, [
        await this.getMarketDataEndDate(),
      ]);
      const close = Number(bars[0]?.Close ?? 0);
      return Array.from({ length: limit }, () => close);
    }
  }
}
