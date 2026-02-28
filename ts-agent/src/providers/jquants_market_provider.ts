import { join } from "node:path";
import { z } from "zod";
import type {
  CalendarEntry,
  DailyQuote,
  FinancialStatement,
} from "../schemas/pead_domain_schema.ts";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./sqlite_http_response_cache.ts";

const extractRows = (payload: Record<string, unknown>): unknown[] => {
  const topLevel = Object.values(payload).find((v) => Array.isArray(v));
  const nested = Object.values(payload)
    .filter((v) => typeof v === "object" && v !== null && !Array.isArray(v))
    .flatMap((v) => Object.values(v as Record<string, unknown>))
    .find((v) => Array.isArray(v));
  const selected = topLevel || nested || [];
  return z.array(z.unknown()).catch([]).parse(selected);
};

export class JQuantsProvider {
  private readonly baseUrl = "https://api.jquants.com/v2";
  private readonly apiKey: string;
  private readonly cache: SqliteHttpCache | undefined;
  private readonly cacheTtlMs: number;

  constructor(options?: { cache?: SqliteHttpCache; cacheTtlMs?: number }) {
    if (!core.config.providers.jquants.enabled) {
      process.exit(1);
    }
    this.apiKey = core.getEnv("JQUANTS_API_KEY");
    this.cache = options?.cache;
    this.cacheTtlMs = options?.cacheTtlMs ?? 5 * 60 * 1000;
  }

  public async request(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    if (this.cache) {
      return this.cache.fetchJson(
        url.toString(),
        { "x-api-key": this.apiKey },
        this.cacheTtlMs,
      );
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": this.apiKey,
      },
    });
    response.ok || process.exit(1);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  }

  public async requestRows(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<unknown[]> {
    const payload = await this.request(endpoint, params);
    return extractRows(payload);
  }

  public async probeListedInfo(): Promise<{
    status: number;
    listed: unknown[];
  }> {
    const response = await fetch("https://api.jquants.com/v2/equities/master", {
      headers: {
        "x-api-key": this.apiKey,
      },
    });
    const payload = z
      .record(z.string(), z.unknown())
      .parse(await response.json());
    return {
      status: response.status,
      listed: extractRows(payload),
    };
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
  });

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<CalendarEntry[]> {
    return (await this.provider.getEarningsCalendar(params)) as CalendarEntry[];
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<FinancialStatement[]> {
    return (await this.provider.getStatements(params)) as FinancialStatement[];
  }

  public async getDailyQuotes(
    params: Record<string, string>,
  ): Promise<DailyQuote[]> {
    return (await this.provider.getDailyQuotes(params)) as DailyQuote[];
  }
}

if (import.meta.main) {
  const provider = new JQuantsProvider();
  const info = await provider.getListedInfo();
  console.log(info);
}
