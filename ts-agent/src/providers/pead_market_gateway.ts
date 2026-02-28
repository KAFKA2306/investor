import { join } from "node:path";
import { z } from "zod";
import type { PeadDataProvider } from "../agents/pead.ts";
import { core } from "../system/core.ts";
import { SqliteHttpCache } from "./sqlite_http_cache.ts";
import type { CalendarEntry, DailyQuote, FinancialStatement } from "../schemas/pead.ts";

const safeRecordArray = (
  value: unknown,
): Record<string, number | string | boolean | null>[] =>
  z
    .array(
      z.record(
        z.string(),
        z.union([z.number(), z.string(), z.boolean(), z.null()]),
      ),
    )
    .catch([])
    .parse(value);

const findFirstArray = (value: unknown): unknown[] | undefined =>
  Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? Object.values(value as Record<string, unknown>)
        .map((v) => findFirstArray(v))
        .find((v) => v !== undefined)
      : undefined;

const extractRows = (payload: Record<string, unknown>): unknown[] => {
  if (Array.isArray(payload.data)) return payload.data;
  return findFirstArray(payload) ?? [];
};

export class PeadJquantsGateway implements PeadDataProvider {
  private readonly apiKey = z
    .object({ JQUANTS_API_KEY: z.string().min(1) })
    .parse(process.env).JQUANTS_API_KEY;

  private readonly cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "jquants_pead_cache.sqlite"),
  );

  private async fetchRows(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<unknown[]> {
    const url = new URL(`https://api.jquants.com/v2${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const payload = await this.cache.fetchJson(
      url.toString(),
      { "x-api-key": this.apiKey },
      43200000, // 12 hours
    );

    console.log(`[DEBUG] J-Quants Fetch: ${url.toString()} -> Payload: ${JSON.stringify(payload).slice(0, 200)}...`);

    if (
      payload &&
      !("message" in payload && typeof payload.message === "string")
    ) {
      return safeRecordArray(extractRows(payload));
    }

    throw new Error(
      `J-Quants API Error at ${endpoint}: ${JSON.stringify(payload)}`,
    );
  }

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<CalendarEntry[]> {
    return (await this.fetchRows(
      "/equities/earnings-calendar",
      params,
    )) as CalendarEntry[];
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<FinancialStatement[]> {
    return (await this.fetchRows(
      "/fins/summary",
      params,
    )) as FinancialStatement[];
  }

  public async getDailyQuotes(
    params: Record<string, string>,
  ): Promise<DailyQuote[]> {
    return (await this.fetchRows(
      "/listed/daily_quotes",
      params,
    )) as DailyQuote[];
  }
}
