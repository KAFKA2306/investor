import { core } from "../../system/app_runtime_core.ts";

export class PolymarketDataGateway {
  private baseUrl = "https://data-api.polymarket.com";

  private get headers(): Record<string, string> {
    const apiKey = core.getEnv("Polymarket_apiKey");
    return apiKey ? { "x-api-key": apiKey } : {};
  }

  public async getUserTrades(address: string) {
    const url = `${this.baseUrl}/trades?user=${address}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new Error(`Polymarket Data API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  public async getUserPositions(address: string) {
    const url = `${this.baseUrl}/positions?user=${address}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new Error(`Polymarket Data API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }
}
