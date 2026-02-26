import { z } from "zod";
import type { PeadDataProvider } from "../agents/pead.ts";
import type { CalendarEntry, FinancialStatement } from "../schemas/pead.ts";

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

const extractRows = (payload: Record<string, unknown>): unknown[] =>
  findFirstArray(payload) ?? [];

export class PeadJquantsGateway implements PeadDataProvider {
  private readonly apiKey = z
    .object({ JQUANTS_API_KEY: z.string().min(1) })
    .parse(process.env).JQUANTS_API_KEY;

  private async fetchRows(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<unknown[]> {
    const url = new URL(`https://api.jquants.com/v2${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    const response = await fetch(url.toString(), {
      headers: { "x-api-key": this.apiKey },
    });
    if (!response.ok) {
      throw new Error(`J-Quants API Error: ${response.status}`);
    }
    const payload = z
      .record(z.string(), z.unknown())
      .parse(await response.json());
    return safeRecordArray(extractRows(payload));
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
}
