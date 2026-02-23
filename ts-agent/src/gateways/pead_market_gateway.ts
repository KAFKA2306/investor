import { z } from "zod";
import type { PeadDataProvider } from "../agents/pead.ts";

const safeRecordArray = (value: unknown): Record<string, unknown>[] =>
  z.array(z.record(z.string(), z.unknown())).catch([]).parse(value);

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
      process.exit(1);
    }
    const payload = z
      .record(z.string(), z.unknown())
      .parse(await response.json());
    return safeRecordArray(extractRows(payload));
  }

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return this.fetchRows("/equities/earnings-calendar", params);
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    return this.fetchRows("/fins/summary", params);
  }
}
