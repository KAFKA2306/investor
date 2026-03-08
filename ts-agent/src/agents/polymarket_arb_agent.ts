import { PolymarketGateway } from "../io/market/polymarket_clob_client.ts";
import type { ArbOpportunity } from "../schemas/polymarket_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

export class PolymarketArbAgent extends BaseAgent {
  private gateway = new PolymarketGateway();
  private targetMarkets: Array<{
    name: string;
    yesToken: string;
    noToken: string;
  }> = [];

  public async run(): Promise<void> {
    const config = (this.core.config as any).polymarket;
    await this.discoverMarkets();
    let lastDiscovery = Date.now();

    while (true) {
      if (Date.now() - lastDiscovery > config.discovery_interval_ms) {
        await this.discoverMarkets();
        lastDiscovery = Date.now();
      }
      for (const market of this.targetMarkets) {
        await this.checkArbitrage(market);
      }
      await new Promise((resolve) => setTimeout(resolve, config.loop_delay_ms));
    }
  }

  private async discoverMarkets() {
    const marketsData = await this.gateway.getMarkets();
    const newMarkets: typeof this.targetMarkets = [];
    const rawMarkets = Array.isArray(marketsData)
      ? marketsData
      : (marketsData as any).data || [];

    for (const m of rawMarkets) {
      if (m.active && !m.closed && m.tokens && m.tokens.length === 2) {
        const yesToken = m.tokens.find(
          (t: any) => t.outcome === "Yes",
        )?.token_id;
        const noToken = m.tokens.find((t: any) => t.outcome === "No")?.token_id;
        if (yesToken && noToken) {
          newMarkets.push({
            name: m.question,
            yesToken,
            noToken,
          });
        }
      }
    }
    this.targetMarkets = newMarkets;
  }

  private async checkArbitrage(market: {
    name: string;
    yesToken: string;
    noToken: string;
  }) {
    const config = (this.core.config as any).polymarket;
    const [yesBook, noBook] = await Promise.all([
      this.gateway.getOrderbook(market.yesToken),
      this.gateway.getOrderbook(market.noToken),
    ]);

    const bestAskYes = parseFloat(yesBook.asks[0]?.price || "1.0");
    const bestAskNo = parseFloat(noBook.asks[0]?.price || "1.0");
    const totalPrice = bestAskYes + bestAskNo;
    const expectedGrossProfit = 1.0 - totalPrice;
    const fee = expectedGrossProfit * config.fee_rate;
    const gas = config.gas_cost;
    const netProfit = expectedGrossProfit - fee - gas;

    if (totalPrice < config.arb_threshold && netProfit > 0) {
      this.emitEvent("SYSTEM_LOG", {
        subtype: "ARB_OPPORTUNITY_DETECTED",
        marketId: market.name,
        profit: netProfit,
      } as any);
      await this.executeArbTrade(market.yesToken, market.noToken);
    }
  }

  private async executeArbTrade(yesToken: string, noToken: string) {
    const config = (this.core.config as any).polymarket;
    const size = config.default_trade_size;
    await Promise.all([
      this.gateway.createMarketOrder(yesToken, size, "BUY", "FOK"),
      this.gateway.createMarketOrder(noToken, size, "BUY", "FOK"),
    ]);
    logger.info("TRADE EXECUTED");
  }
}
