import { z } from "zod";
import { EstatProvider } from "./estat.ts";
import { JQuantsProvider } from "./jquants.ts";

export class ApiVerifyGateway {
  private readonly jquants = new JQuantsProvider();
  private readonly estat = new EstatProvider();

  public async getJquantsListedInfo(): Promise<Record<string, unknown>[]> {
    return z
      .array(z.record(z.string(), z.unknown()))
      .catch([])
      .parse(await this.jquants.getListedInfo());
  }

  public async getEstatStatsData(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    return z
      .record(z.string(), z.unknown())
      .parse(await this.estat.getStats(statsDataId));
  }
}
