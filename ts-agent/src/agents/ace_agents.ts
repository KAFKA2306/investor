import type { z } from "zod";
import type { ContextPlaybook } from "../core/playbook";
import type { DailyScenarioLogSchema, UnifiedLog } from "../schemas/log";

/**
 * OpenCE: Evaluation Pillar
 * AceEvaluator (formerly AceReflector): Analyzes execution logs to extract actionable insights.
 */
export class AceEvaluator {
  /**
   * Generates insights from a run log.
   */
  async evaluate(runLog: UnifiedLog): Promise<{
    insights: string[];
    helpfulIds: string[];
    harmfulIds: string[];
  }> {
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

    return { insights, helpfulIds, harmfulIds };
  }
}

/**
 * OpenCE: Acquisition Pillar
 * AceAcquirer (formerly AceStrategyMiner): Discovers and proposes new, high-value orthogonal strategies.
 */
export class AceAcquirer {
  /**
   * Proposes new strategy hypotheses based on market structural gaps.
   */
  async acquireAlphaFrontiers(): Promise<string[]> {
    return [
      "Cross-Liquidity Arbitrage: 指数寄与度と個別株の流動性ミスマッチを突く平均回帰戦略。",
      "Earnings Surprise Alpha (PEAD): 決算発表後のモメンタムドリフトを基盤モデル（Chronos/TimesFM）で強化した検証系。",
      "Sentiment-Volume Divergence: SNSセンチメントと出来高乖離による反転シグナル。",
      "Inter-Sector Relative Strength: セクター間モーメンタムの直行性を検証する動的配分ロジック。",
    ];
  }
}

/**
 * OpenCE: Evolution Pillar
 * AceEvolver (formerly AceCurator): Manages the Playbook updates based on Evaluation signals.
 */
export class AceEvolver {
  constructor(private playbook: ContextPlaybook) {}

  async evolve(
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
          source: "AceEvaluator",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 3. Save and Prune
    await this.playbook.save();
    const removedCount = await this.playbook.prune();
    console.log(
      `OpenCE Evolver: Applied ${insights.length} insights, pruned ${removedCount} stale bullets.`,
    );
  }
}
