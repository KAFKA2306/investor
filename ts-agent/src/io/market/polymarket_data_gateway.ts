import { core } from "../../system/app_runtime_core.ts";

export class PolymarketDataGateway {
  private baseUrl = "https://data-api.polymarket.com";

  private get headers() {
    const apiKey = core.getEnv("Polymarket_apiKey");
    return apiKey ? { "x-api-key": apiKey } : {};
  }

  public async getUserTrades(address: string) {
    const url = `${this.baseUrl}/trades?user=${address}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) return [];
    return await response.json();
  }

  public async getUserPositions(address: string) {
    const url = `${this.baseUrl}/positions?user=${address}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) return [];
    return await response.json();
  }
}
