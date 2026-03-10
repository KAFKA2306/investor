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
        apiKey,
        apiSecret,
        apiPassphrase,
      },
    );
  }

  async scanMarkets(): Promise<Market[]> {
    const response: any = await this.client.getMarkets();
    const markets = response.data || response;
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
      token_id: tokenId,
      price: price,
      size: size,
      side: side as any,
    });
  }
}
