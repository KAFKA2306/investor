import * as fs from "node:fs";
import { mixseekCompetitiveFrameworkSkill } from "./builtin/mixseek_competitive_framework.ts";

const testInput = {
  candidates: [
    {
      factor_id: "MOM-5-20",
      formula: "Mean($close, 5) / Mean($close, 20)",
      economic_mechanism: "5-day vs 20-day momentum",
    },
    {
      factor_id: "REV-VOL",
      formula: "-(Mean($close,1)/Mean($close,5)-1) * Rank(Std($close,5))",
      economic_mechanism: "mean reversion × volatility rank",
    },
    {
      factor_id: "VOL-RATIO",
      formula: "Rank(Mean($volume, 3) / Mean($volume, 20))",
      economic_mechanism: "short-term vs long-term volume ratio",
    },
  ],
  backtest_config: {
    start_date: "2024-01-01",
    end_date: "2025-12-31",
    universe: "jp_stocks_300",
    rebalance_frequency: "daily",
  },
};

async function main() {
  const result = await mixseekCompetitiveFrameworkSkill.execute(testInput);

  const output = {
    winner: result.winner,
    rankings: result.rankings,
    competition_metadata: result.competition_metadata,
  };

  fs.writeFileSync(
    "/tmp/test_with_skill_output.json",
    JSON.stringify(output, null, 2),
  );
  console.log("✓ Test scenario executed successfully");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
