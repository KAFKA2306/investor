import { z } from "zod";
import { YFinanceProvider } from "../../providers/yfinance.ts";
import { SqliteHttpCache } from "../cache/sqlite_http_cache.ts";

export type MarketDataGateway = {
  getEstatStats(statsDataId: string): Promise<Record<string, unknown>>;
  getListedInfo(): Promise<Record<string, unknown>[]>;
  getDailyBars(
    symbol: string,
    dates: readonly string[],
  ): Promise<Record<string, unknown>[]>;
  getStatements(symbol: string): Promise<Record<string, unknown>[]>;
  getMarketDataEndDate(): Promise<string>;
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
        .parse(b["Date"])
        .localeCompare(z.string().catch("").parse(a["Date"])),
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
    `${process.cwd()}/../logs/cache/market_cache.sqlite`,
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
}
