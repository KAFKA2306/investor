import { core } from "../system/app_runtime_core.ts";
import { fsUtils } from "../utils/fs_utils.ts";
import { logger } from "../utils/logger.ts";

async function main() {
  logger.info("📡 Fetching current Polymarket leaderboard (Monthly PNL)...");

  const url =
    "https://data-api.polymarket.com/v1/leaderboard?category=OVERALL&timePeriod=MONTH&orderBy=PNL&limit=10";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch leaderboard: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const topWallets = data.map((item: any) => ({
    rank: item.rank,
    address: item.proxyWallet,
    userName: item.userName,
    pnl: item.pnl,
  }));

  console.log("🏆 Current Top Traders (Monthly Profit):");
  topWallets.forEach((w: any) => {
    console.log(
      `${w.rank}. ${w.userName} (${w.address}) - PNL: $${Math.round(w.pnl).toLocaleString()}`,
    );
  });

  // YAMLを直接書き換えるのはリスクがあるため、まずはJSONとして保存し、
  // エージェントが手動で config/default.yaml を更新するか、
  // 実行時にこのリストを読み込むようにするよっ！
  const outputPath = "ts-agent/data/current_polymarket_targets.json";
  fsUtils.writeValidatedJson(outputPath, topWallets);

  logger.info(
    `✅ Successfully extracted ${topWallets.length} targets to ${outputPath}`,
  );
}

main();
