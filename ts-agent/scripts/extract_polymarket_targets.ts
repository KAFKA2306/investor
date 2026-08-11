import { writeValidatedJson } from "../src/utils/fs_utils.ts";
import { logger } from "../src/utils/logger.ts";

type LeaderboardRow = {
  rank: number;
  proxyWallet: string;
  userName: string;
  pnl: number;
};

function isLeaderboardRow(value: unknown): value is LeaderboardRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.rank === "number" &&
    typeof row.proxyWallet === "string" &&
    typeof row.userName === "string" &&
    typeof row.pnl === "number"
  );
}

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

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Polymarket leaderboard response must be an array");
  }

  const topWallets = data.filter(isLeaderboardRow).map((item) => ({
    rank: item.rank,
    address: item.proxyWallet,
    userName: item.userName,
    pnl: item.pnl,
  }));

  console.log("🏆 Current Top Traders (Monthly Profit):");
  topWallets.forEach((wallet) => {
    console.log(
      `${wallet.rank}. ${wallet.userName} (${wallet.address}) - PNL: $${Math.round(wallet.pnl).toLocaleString()}`,
    );
  });

  // YAMLを直接書き換えるのはリスクがあるため、まずはJSONとして保存し、
  // エージェントが手動で config/default.yaml を更新するか、
  // 実行時にこのリストを読み込むようにするよっ！
  const outputPath = "ts-agent/data/current_polymarket_targets.json";
  writeValidatedJson(outputPath, topWallets);

  logger.info(
    `✅ Successfully extracted ${topWallets.length} targets to ${outputPath}`,
  );
}

main();
