import { join } from "node:path";
import { z } from "zod";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./cache_providers.ts";

/**
 * e-Stat (Portal Site of Official Statistics of Japan) Provider
 */
export class EstatProvider {
  private readonly baseUrl =
    "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
  private readonly appId: string;

  constructor() {
    if (!core.config.providers.estat.enabled) {
      process.exit(1);
    }
    this.appId = core.getEnv("ESTAT_APP_ID");
  }

  public async getStats(statsDataId: string): Promise<unknown> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("appId", this.appId);
    url.searchParams.set("statsDataId", statsDataId);
    url.searchParams.set("lang", "J");
    const response = await fetch(url.toString());
    if (!response.ok) process.exit(1);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  }
}

/**
 * JQuants (Japan Exchange Group) Provider
 */
const extractJQuantsRows = (payload: Record<string, unknown>): unknown[] => {
  const topLevel = Object.values(payload).find((v) => Array.isArray(v));
  const nested = Object.values(payload)
    .filter((v) => typeof v === "object" && v !== null && !Array.isArray(v))
    .flatMap((v) => Object.values(v as Record<string, unknown>))
    .find((v) => Array.isArray(v));
  return z
    .array(z.unknown())
    .catch([])
    .parse(topLevel || nested || []);
};

export class JQuantsProvider {
  private readonly baseUrl = "https://api.jquants.com/v2";
  private readonly apiKey: string;
  private readonly cache: SqliteHttpCache | undefined;
  private readonly cacheTtlMs: number;

  constructor(options?: { cache?: SqliteHttpCache; cacheTtlMs?: number }) {
    if (!core.config.providers.jquants.enabled) process.exit(1);
    this.apiKey = core.getEnv("JQUANTS_API_KEY");
    this.cache = options?.cache;
    this.cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
  }

  public async request(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
    if (this.cache)
      return this.cache.fetchJson(
        url.toString(),
        { "x-api-key": this.apiKey },
        this.cacheTtlMs,
      );
    const response = await fetch(url.toString(), {
      headers: { "x-api-key": this.apiKey },
    });
    if (!response.ok) process.exit(1);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  }

  public async requestRows(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<unknown[]> {
    const payload = await this.request(endpoint, params);
    return extractJQuantsRows(payload);
  }

  public async getListedInfo(): Promise<unknown[]> {
    return this.requestRows("/equities/master");
  }
  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return this.requestRows("/equities/earnings-calendar", params);
  }
  public async getStatements(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return this.requestRows("/fins/summary", params);
  }
  public async getDailyQuotes(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return this.requestRows("/listed/daily_quotes", params);
  }
}

/**
 * PEAD JQuants Gateway
 */
export class PeadJquantsGateway {
  private readonly provider = new JQuantsProvider({
    cache: new SqliteHttpCache(
      join(core.config.paths.logs, "cache", "jquants_pead_cache.sqlite"),
    ),
    cacheTtlMs: 12 * 60 * 60 * 1000,
  });

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return await this.provider.getEarningsCalendar(params);
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return await this.provider.getStatements(params);
  }

  public async getDailyQuotes(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return await this.provider.getDailyQuotes(params);
  }
}

/**
 * Yahoo Finance Gateway
 */
export interface YahooBar {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  CorrectionCount?: number; // [NEW] EDINET Signals
  LargeHolderCount?: number; // [NEW] EDINET Signals
  MacroIIP?: number; // [NEW] e-Stat Signals
  MacroCPI?: number; // [NEW] e-Stat Signals
  SegmentSentiment?: number; // [NEW] 10-K Intelligence 2.0
  AiExposure?: number; // [NEW] 10-K Intelligence 2.0
  KgCentrality?: number; // [NEW] 10-K Intelligence 2.0
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
    const resRaw = (
      payload as {
        chart: {
          result: {
            timestamp: number[];
            indicators: {
              quote: {
                open: number[];
                high: number[];
                low: number[];
                close: number[];
                volume: number[];
              }[];
            };
          }[];
        };
      }
    ).chart.result[0];
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
      if (typeof ts === "number" && open !== null && close !== null) {
        bars.push({
          Date: new Date(ts * 1000).toISOString().split("T")[0]!,
          Open: open ?? 0,
          High: highs[i] ?? close ?? 0,
          Low: lows[i] ?? close ?? 0,
          Close: close ?? 0,
          Volume: volumes[i] ?? 0,
        });
      }
    }
    return bars;
  }
}
