import { describe, it, expect } from "vitest";
import { mixseekCompetitiveFrameworkSkill } from "../builtin/mixseek_competitive_framework.ts";

describe("mixseek-competitive-framework", () => {
  it("evaluates three Qlib candidates and ranks by Sharpe ratio", async () => {
    const input = {
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

    const result = await mixseekCompetitiveFrameworkSkill.execute(input);

    expect(result).toBeDefined();
    expect(result.winner).toBeDefined();
    expect(result.winner.factor_id).toBe("REV-VOL");
    expect(result.winner.performance.sharpe).toBe(2.15);
    expect(result.rankings).toHaveLength(3);
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[0].factor_id).toBe("REV-VOL");
    expect(result.competition_metadata.total_candidates).toBe(3);
    expect(result.competition_metadata.ranking_metric).toBe("sharpe_ratio");
  });
});
