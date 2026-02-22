import { core } from "../core/index.ts";

export class EstatProvider {
  constructor() {
    if (!core.config.providers.estat.enabled) {
      process.exit(1);
    }
  }

  public async getStats(_appId: string, statsDataId: string): Promise<unknown> {
    console.log(`Fetching e-STAT data for ${statsDataId}`);
    return {};
  }
}
