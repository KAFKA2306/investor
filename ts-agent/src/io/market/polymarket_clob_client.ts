import { ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import {
  type Orderbook,
  OrderbookSchema,
} from "../../schemas/polymarket_schemas.ts";
import { core } from "../../system/app_runtime_core.ts";

export class PolymarketGateway {
  private client: ClobClient;

  constructor() {
    const config = (core.config as any).polymarket;
    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) throw new Error("POLYMARKET_PRIVATE_KEY is missing");

    const wallet = new ethers.Wallet(privateKey);
    this.client = new ClobClient(
      config.clob_url,
      config.chain_id,
      wallet as any,
      {
        key: process.env.Polymarket_apiKey!,
        secret: process.env.Polymarket_secret!,
        passphrase: process.env.Polymarket_passphrase!,
      },
    );
  }

  public async getOrderbook(tokenId: string): Promise<Orderbook> {
    const rawOrderbook = await this.client.getOrderBook(tokenId);
    return OrderbookSchema.parse(rawOrderbook);
  }

  public async getMarkets(nextCursor: string = "") {
    return await this.client.getMarkets(nextCursor);
  }

  public async getMarket(conditionId: string) {
    return await this.client.getMarket(conditionId);
  }

  public async createMarketOrder(
    tokenId: string,
    amount: number,
    side: "BUY" | "SELL",
    timeInForce: "FOK" | "IOC" = "IOC",
  ) {
    return await this.client.createOrder({
      tokenID: tokenId,
      price: side === "BUY" ? 1.0 : 0.0,
      side: side as any,
      size: Math.round(amount * 10000) / 10000,
      feeRateBps: 0,
      timeInForce: timeInForce as any,
    } as any);
  }
}
