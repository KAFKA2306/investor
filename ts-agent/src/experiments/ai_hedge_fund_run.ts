import { EventDrivenAnalystAgent } from "../agents/event_driven_analyst_agent.ts";
import { ExecutiveReporterAgent } from "../agents/executive_reporter_agent.ts";
import { FundamentalAuditAgent } from "../agents/fundamental_audit_agent.ts";
import { MacroTopDownAgent } from "../agents/macro_top_down_agent.ts";
import { MeanReversionAgent } from "../agents/mean_reversion_agent.ts";
import { RiskHedgingAgent } from "../agents/risk_hedging_agent.ts";
import { WhaleWatcherAgent } from "../agents/whale_watcher_agent.ts";
import { logger } from "../utils/logger.ts";

/**
 * 🚀 AIヘッジファンド・パイプライン：全てのプロを召喚するよっ！✨
 */
async function runHedgeFundPipeline() {
  logger.info("🎬 [HedgeFundPipeline] Booting up full analyst team...");

  const macro = new MacroTopDownAgent();
  const meanRev = new MeanReversionAgent();
  const event = new EventDrivenAnalystAgent();
  const fundamental = new FundamentalAuditAgent();
  const whale = new WhaleWatcherAgent();
  const hedging = new RiskHedgingAgent();
  const reporter = new ExecutiveReporterAgent();

  // 1. マクロ環境の把握
  await macro.run();

  // 2. 平均回帰と統計的裁定の探索
  await meanRev.run();

  // 3. イベント・チャンスの探索
  await event.run();

  // 4. 数字の裏付けとリスク確認
  await fundamental.run();

  // 5. クジラたちの動きをチェック
  await whale.run();

  // 6. 防御策の構築
  await hedging.run();

  // 7. 最後に全ての知恵を週報へ！
  await reporter.run();

  logger.info(
    "🎊 [HedgeFundPipeline] All analyst reports generated! Mission Accomplished. 🌈",
  );
}

// 直接実行された場合の処理だよっ！
if (import.meta.main) {
  runHedgeFundPipeline();
}
