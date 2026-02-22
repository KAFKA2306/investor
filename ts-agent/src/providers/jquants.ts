import { core } from "../core/index.ts";

export interface JQuantsResponse<T> {
  data: T[];
  pagination?: {
    nextPageToken?: string;
  };
}

export class JQuantsProvider {
  private readonly baseUrl = "https://api.jpx-jquants.com/v2";
  private readonly apiKey: string;

  constructor() {
    if (!core.config.providers.jquants.enabled) {
      process.exit(1);
    }
    this.apiKey = core.getEnv("JQUANTS_API_KEY");
  }

  protected async request<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      process.exit(1);
    }

    return response.json() as Promise<T>;
  }

  public async getListedInfo(): Promise<unknown[]> {
    const res =
      await this.request<JQuantsResponse<unknown>>("/equities/listed");
    return res.data;
  }

  public async getEarningsCalendar(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    const res = await this.request<JQuantsResponse<unknown>>(
      "/equities/earnings-calendar",
      params,
    );
    return res.data;
  }

  public async getStatements(
    params: Record<string, string>,
  ): Promise<unknown[]> {
    const res = await this.request<JQuantsResponse<unknown>>(
      "/fins/statements",
      params,
    );
    return res.data;
  }
}

if (import.meta.main) {
  const provider = new JQuantsProvider();
  const info = await provider.getListedInfo();
  console.log(info);
}
