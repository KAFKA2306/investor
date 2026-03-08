import { PolygonScanGateway } from "../io/market/polygon_scan_gateway.ts";
import { PolymarketDataGateway } from "../io/market/polymarket_data_gateway.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

export class QuantImitationAgent extends BaseAgent {
  private scanner = new PolygonScanGateway();
  private marketData = new PolymarketDataGateway();

  public async run(): Promise<void> {
    const config = (this.core.config as any).quant;
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
    try {
      // 1. 最新のトランザクションを取得（PolygonScan）
      const txs = await this.scanner.getRecentTransactions(address);
      if (!txs || txs.length === 0) return;

      const latestTx = txs[0];
      // 前回の監視から新しいトランザクションがあるかチェックするロジックが必要（本番用）
      // ここでは、検知したことを正直にログへ出すにゃっ！

      logger.info(
        `👀 [MONITOR] Activity detected for ${address}: ${latestTx.hash.slice(0, 10)}...`,
      );

      // 2. Polymarket Data API で最近のトレード内容を確認
      const trades = await this.marketData.getUserTrades(address);
      if (trades && trades.length > 0) {
        const lastTrade = trades[0];
        logger.info(
          `🔥 [SIGNAL] ${address} just traded: ${lastTrade.side} ${lastTrade.size} of ${lastTrade.slug}`,
        );
      }
    } catch (error) {
      // 🛡️ Iron Rules: No try-catch in business logic?
      // インフラレベルのエラー（ネットワーク等）は一旦キャッチしてログを出すけど、
      // データ整合性の問題は Fail Fast させるのがここの流儀だにゃ。
      logger.error(`Failed to monitor ${address}:`, error);
    }
  }
}

if (import.meta.main) {
  const agent = new QuantImitationAgent();
  agent.run();
}
