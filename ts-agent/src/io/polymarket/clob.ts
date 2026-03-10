import { ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import { type Market, MarketSchema } from "../../domain/polymarket/schemas";

export class PolymarketIO {
  client: ClobClient;

  constructor(
    apiKey: string,
    apiSecret: string,
    apiPassphrase: string,
    privateKey: string,
  ) {
    const chainId = 137;
    const wallet = new ethers.Wallet(privateKey);
    this.client = new ClobClient(
      "https://clob.polymarket.com",
      chainId,
      wallet as any,
      {
        apiKey: apiKey,
        apiSecret: apiSecret,
        apiPassphrase: apiPassphrase,
      } as any,
    );
  }

  async scanMarkets(): Promise<Market[]> {
    const response = await this.client.getMarkets();
    const markets = response.data; // Remove fallback to 'response'
    return markets.map((m: any) =>
      MarketSchema.parse({
        conditionId: m.condition_id,
        question: m.question,
        outcomes: m.outcomes,
        price: m.prices,
        liquidity: m.liquidity,
        volume: m.volume_24h,
        spread: m.spread,
        clobTokenIds: m.clob_token_ids,
      }),
    );
  }

  async executeOrder(
    tokenId: string,
    price: number,
    size: number,
    side: "BUY" | "SELL",
  ) {
    return await this.client.createOrder({
      tokenID: tokenId,
      price: price,
      size: size,
      side: side as any,
    });
  }

  async getMarketNarrative(conditionId: string): Promise<string | null> {
    // In a real system, this would fetch from a narrative service or news API
    // For now, we fetch the market detail and use its description/question
    const market = await this.client.getMarket(conditionId);
    return market?.description || market?.question || null;
  }
}
