import { join } from "node:path";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./cache_providers.ts";
import { requestJson, requestRows } from "./http_json_client.ts";
import { ProviderConfigError } from "./provider_errors.ts";

export class EstatProvider {
  private readonly baseUrl =
    "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
  private readonly appId: string;

  constructor() {
    if (!core.config.providers.estat.enabled) {
      throw new ProviderConfigError("e-Stat provider is disabled");
    }
    this.appId = core.getProviderCredential("estat", "appId", "ESTAT_APP_ID");
  }

  public async getStats(statsDataId: string): Promise<Record<string, unknown>> {
    const res = await requestJson({
      baseUrl: this.baseUrl,
      query: {
        appId: this.appId,
        statsDataId,
        lang: "J",
      },
    });
    return res.payload;
  }
}

export class JQuantsProvider {
  private readonly baseUrl = "https://api.jquants.com/v2";
  private readonly apiKey: string;
  private readonly cache: SqliteHttpCache | undefined;
  private readonly cacheTtlMs: number;
  private readonly allowStaleCache: boolean;

  constructor(options?: {
    cache?: SqliteHttpCache;
    cacheTtlMs?: number;
    allowStaleCache?: boolean;
  }) {
    if (!core.config.providers.jquants.enabled) {
      throw new ProviderConfigError("J-Quants provider is disabled");
    }
    this.apiKey = core.getProviderCredential(
      "jquants",
      "apiKey",
      "JQUANTS_API_KEY",
    );
    this.cache = options?.cache;
    this.cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
    this.allowStaleCache = options?.allowStaleCache ?? true;
  }

  public async request(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const res = await requestJson({
      baseUrl: this.baseUrl,
      endpoint,
      query: params,
      headers: { "x-api-key": this.apiKey },
      ...(this.cache
        ? {
            cache: this.cache,
            ttlMs: this.cacheTtlMs,
            allowStaleCache: this.allowStaleCache,
          }
        : {}),
    });
    return res.payload;
  }

  public async requestRows(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<unknown[]> {
    return requestRows({
      baseUrl: this.baseUrl,
      endpoint,
      query: params,
      headers: { "x-api-key": this.apiKey },
      ...(this.cache
        ? {
            cache: this.cache,
            ttlMs: this.cacheTtlMs,
            allowStaleCache: this.allowStaleCache,
          }
        : {}),
    });
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

export class PeadJquantsGateway {
  private readonly provider = new JQuantsProvider({
    cache: new SqliteHttpCache(
      join(core.config.paths.logs, "cache", "jquants_pead_cache.sqlite"),
    ),
    cacheTtlMs: 12 * 60 * 60 * 1000,
    allowStaleCache: true,
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

export interface YahooBar {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  CorrectionCount?: number;
  LargeHolderCount?: number;
  MacroIIP?: number;
  MacroCPI?: number;
  SegmentSentiment?: number;
  AiExposure?: number;
  KgCentrality?: number;
}

export class YahooFinanceGateway {
  private readonly cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "yahoo_finance_cache.sqlite"),
  );

  public async getChart(symbol: string, range = "2y"): Promise<YahooBar[]> {
    const res = await requestJson({
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      query: { interval: "1d", range },
      cache: this.cache,
      ttlMs: 24 * 60 * 60 * 1000,
    });

    const resRaw = (
      res.payload as {
        chart: {
          result: {
            timestamp: number[];
            indicators: {
              quote: {
                open: (number | null)[];
                high: (number | null)[];
                low: (number | null)[];
                close: (number | null)[];
                volume: (number | null)[];
              }[];
            };
          }[];
        };
      }
    ).chart.result?.[0];

    if (!resRaw) throw new Error(`No data for ${symbol}`);
    const timestamps = resRaw.timestamp || [];
    const quote = resRaw.indicators.quote[0];
    if (!quote) throw new Error(`No quote data for ${symbol}`);

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

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
