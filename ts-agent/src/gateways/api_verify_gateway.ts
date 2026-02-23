import { z } from "zod";

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

const extractRows = (
  payload: Record<string, unknown>,
): Record<string, unknown>[] => safeRecordArray(findFirstArray(payload) ?? []);

export class ApiVerifyGateway {
  private readonly jquantsApiKey = z
    .object({ JQUANTS_API_KEY: z.string().min(1) })
    .parse(process.env).JQUANTS_API_KEY;
  private readonly estatAppId = z
    .object({ ESTAT_APP_ID: z.string().min(1) })
    .parse(process.env).ESTAT_APP_ID;

  public async getJquantsListedInfo(): Promise<Record<string, unknown>[]> {
    const response = await fetch("https://api.jquants.com/v2/equities/master", {
      headers: {
        "x-api-key": this.jquantsApiKey,
      },
    });
    response.ok || process.exit(1);
    const payload = z
      .record(z.string(), z.unknown())
      .parse(await response.json());
    return extractRows(payload);
  }

  public async getEstatStatsData(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData",
    );
    url.searchParams.set("appId", this.estatAppId);
    url.searchParams.set("statsDataId", statsDataId);
    url.searchParams.set("lang", "J");
    const response = await fetch(url.toString());
    response.ok || process.exit(1);
    return z.record(z.string(), z.unknown()).parse(await response.json());
  }
}
