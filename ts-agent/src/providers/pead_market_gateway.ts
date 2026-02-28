import { join } from "node:path";
import type { PeadDataProvider } from "../agents/pead.ts";
import { core } from "../system/core.ts";
import { JQuantsProvider } from "./jquants.ts";
import { SqliteHttpCache } from "./sqlite_http_cache.ts";
import type {
  CalendarEntry,
  DailyQuote,
  FinancialStatement,
} from "../schemas/pead.ts";

export class PeadJquantsGateway implements PeadDataProvider {
  private readonly provider = new JQuantsProvider({
    cache: new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "jquants_pead_cache.sqlite"),
    ),
    cacheTtlMs: 12 * 60 * 60 * 1000,
  });

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<CalendarEntry[]> {
    return (await this.provider.requestRows(
      "/equities/earnings-calendar",
      params,
    )) as CalendarEntry[];
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<FinancialStatement[]> {
    return (await this.provider.requestRows(
      "/fins/summary",
      params,
    )) as FinancialStatement[];
  }

  public async getDailyQuotes(
    params: Record<string, string>,
  ): Promise<DailyQuote[]> {
    return (await this.provider.requestRows(
      "/listed/daily_quotes",
      params,
    )) as DailyQuote[];
  }
}
