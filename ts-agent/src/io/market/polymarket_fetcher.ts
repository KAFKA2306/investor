import {
  PolymarketEventResponseSchema,
  PolymarketPositionResponseSchema,
  PolymarketTradeResponseSchema,
} from "../../domain/market/polymarket_models.ts";
import { core } from "../../system/app_runtime_core.ts";

export class PolymarketFetcher {
  private baseUrl = "https://data-api.polymarket.com";
  private gammaUrl = "https://gamma-api.polymarket.com";

  private get headers(): Record<string, string> {
    const apiKey = core.getEnv("Polymarket_apiKey");
    return apiKey ? { "x-api-key": apiKey } : {};
  }

  public async getUserTrades(address: string) {
    const url = `${this.baseUrl}/trades?user=${address}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(
        `Polymarket API Error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    // Crash immediately if data shape is wrong. No try-catch.
    return PolymarketTradeResponseSchema.parse(data);
  }

  public async getUserPositions(address: string) {
    const url = `${this.baseUrl}/positions?user=${address}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(
        `Polymarket API Error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    // Crash immediately if data shape is wrong. No try-catch.
    return PolymarketPositionResponseSchema.parse(data);
  }

  public async getEvents(limit: number = 10) {
    const url = `${this.gammaUrl}/events?limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Polymarket Gamma API Error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return PolymarketEventResponseSchema.parse(data);
  }
}
