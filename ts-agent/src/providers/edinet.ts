import { core } from "../core/index.ts";

export class EdinetProvider {
  constructor() {
    if (!core.config.providers.edinet.enabled) {
      process.exit(1);
    }
  }

  public async getDocuments(date: string): Promise<unknown[]> {
    console.log(`Searching EDINET documents for ${date}`);
    return [];
  }
}
