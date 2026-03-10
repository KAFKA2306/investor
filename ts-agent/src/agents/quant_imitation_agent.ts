import { PolygonScanGateway } from "../io/market/polygon_scan_gateway.ts";
import { PolymarketDataGateway } from "../io/market/polymarket_data_gateway.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

export class QuantImitationAgent extends BaseAgent {
  private scanner = new PolygonScanGateway();
  private marketData = new PolymarketDataGateway();

  public async run(): Promise<void> {
    const config = (this.core.config as unknown as { quant: { target_addresses: string[]; imitation_delay_ms: number } }).quant;
    const targets = config.target_addresses || [];

    logger.info(
      `🚀 Starting Quant Imitation Agent on ${targets.length} targets...`,
    );

    while (true) {
      for (const address of targets) {
        await this.monitorAddress(address);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, config.imitation_delay_ms || 10000),
      );
    }
  }

  private async monitorAddress(address: string) {
    // 1. 最新のトランザクションを取得（PolygonScan）
    const txs = await this.scanner.getRecentTransactions(address);
    if (!txs || txs.length === 0) return;

    const latestTx = txs[0] as any;

    logger.info(
      `👀 [MONITOR] Activity detected for ${address}: ${latestTx.hash.slice(0, 10)}...`,
    );

    // 2. Polymarket Data API で最近のトレード内容を確認
    const trades = (await this.marketData.getUserTrades(address)) as Array<{ side: string; size: number; slug: string }>;
    if (trades && trades.length > 0) {
      const lastTrade = trades[0];
      logger.info(
        `🔥 [SIGNAL] ${address} just traded: ${lastTrade.side} ${lastTrade.size} of ${lastTrade.slug}`,
      );
    }
  }
}

if (import.meta.main) {
  const agent = new QuantImitationAgent();
  agent.run();
}
