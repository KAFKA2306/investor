import type { z } from "zod";
import type { ContextPlaybook } from "../core/playbook";
import type { DailyScenarioLogSchema, UnifiedLog } from "../schemas/log";

/**
 * AceReflector: Analyzes execution logs to extract actionable insights.
 */
export class AceReflector {
  /**
   * Generates insights from a run log.
   * In a real implementation, this would call an LLM.
   * For "highest logic" simulation, we provide a structured analyzer.
   */
  async reflect(runLog: UnifiedLog): Promise<{
    insights: string[];
    helpfulIds: string[];
    harmfulIds: string[];
  }> {
    // Logic: If sharpe < 0 or totalReturn < 0, it's a failure (Harmful)
    // If sharpe > 1, it's a success (Helpful)
    const insights: string[] = [];
    const helpfulIds: string[] = [];
    const harmfulIds: string[] = [];

    if (runLog.schema !== "investor.daily-log.v1") {
      return { insights, helpfulIds, harmfulIds };
    }

    const report = runLog.report as z.infer<typeof DailyScenarioLogSchema>;
    const results = report.results?.backtest;

    if (!results || results.sharpe === undefined)
      return { insights, helpfulIds, harmfulIds };

    if (results.sharpe < 0.5) {
      insights.push(
        `Low Sharpe ratio (${results.sharpe.toFixed(2)}) detected. Strategy might be too volatile or trend-following in ranging market.`,
      );
    } else if (results.sharpe > 1.5) {
      insights.push(
        `Excellent Sharpe ratio (${results.sharpe.toFixed(2)}). Core alpha remains strong.`,
      );
    }

    // In a real scenario, the LLM would look at raw signals vs market outcome.
    return { insights, helpfulIds, harmfulIds };
  }
}

/**
 * AceStrategyMiner: Discovers and proposes new, high-value orthogonal strategies.
 * This is the 'Generator' for the frontier expansion mission.
 */
export class AceStrategyMiner {
  /**
   * Proposes new strategy hypotheses based on market structural gaps.
   */
  async proposeAlphaFrontiers(): Promise<string[]> {
    return [
      "Cross-Liquidity Arbitrage: 利用可能なJ-Quantsデータを用い、指数寄与度と個別株の流動性ミスマッチを突く平均回帰戦略。",
      "Earnings Surprise Alpha (PEAD): 決算発表後のモメンタムドリフト（PEAD）を、Chronos/TimesFMによる非線形予測で強化した検証系。",
      "Sentiment-Volume Divergence: X Intelligenceを活用し、感情の極端な乖離と出来高の急増をトリガーとする反転シグナルの検証。",
      "Inter-Sector Relative Strength: セクター間モーメンタムの直行性を検証し、相関が低いセクターへの動的配分ロジック。",
    ];
  }
}

/**
 * AceCurator: Manages the Playbook updates based on Reflector insights.
 */
export class AceCurator {
  constructor(private playbook: ContextPlaybook) {}

  async applyInsights(
    insights: string[],
    helpfulIds: string[],
    harmfulIds: string[],
  ): Promise<void> {
    // 1. Update helpful/harmful counts for existing bullets
    const allBullets = this.playbook.getBullets();
    for (const b of allBullets) {
      if (helpfulIds.includes(b.id)) {
        b.helpful_count++;
        b.updated_at = new Date().toISOString();
      }
      if (harmfulIds.includes(b.id)) {
        b.harmful_count++;
        b.updated_at = new Date().toISOString();
      }
    }

    // 2. Add new insights as new bullets
    for (const content of insights) {
      this.playbook.addBullet({
        content,
        section: "insights",
        metadata: {
          source: "AceReflector",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 3. Save and Pruen
    await this.playbook.save();
    const removedCount = await this.playbook.prune();
    console.log(
      `ACE Curator: Applied ${insights.length} insights, pruned ${removedCount} stale bullets.`,
    );
  }
}
