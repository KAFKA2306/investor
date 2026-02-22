import { core } from "../core/index.ts";

export class EdinetProvider {
  private readonly baseUrl =
    "https://disclosure.edinet-fsa.go.jp/api/v2/documents.json";
  private readonly apiKey: string;

  constructor() {
    if (!core.config.providers.edinet.enabled) {
      process.exit(1);
    }
    this.apiKey = core.getEnv("EDINET_API_KEY");
  }

  public async getDocuments(date: string): Promise<unknown[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("date", date);
    url.searchParams.set("type", "2");
    url.searchParams.set("Subscription-Key", this.apiKey);

    const response = await fetch(url.toString());
    response.ok || process.exit(1);

    const data = (await response.json()) as {
      results?: unknown[];
    };
    return data.results ?? [];
  }
}
