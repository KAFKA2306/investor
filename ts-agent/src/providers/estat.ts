import { z } from "zod";
import { core } from "../core/index.ts";

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
    response.ok || process.exit(1);

    return z.record(z.string(), z.unknown()).parse(await response.json());
  }
}
