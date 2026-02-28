import type { z } from "zod";
import type { ContextPlaybook } from "../context/context_playbook_manager.ts";
import type { DailyScenarioLogSchema, UnifiedLog } from "../schemas/unified_log_schema.ts";
import type {
  EvaluationResult,
  IAcquirer,
  IConstructor,
  IEvaluator,
  IEvolver,
  IProcessor,
} from "../system/opence/opence_contract_interfaces.ts";

/**
 * OpenCE: Evaluation Pillar
 * AceEvaluator: Analyzes execution logs to extract actionable insights.
 */
export class AceEvaluator implements IEvaluator {
  /**
   * Generates insights from a run log.
   */
  async evaluate(output: UnifiedLog): Promise<EvaluationResult> {
    const runLog = output;
    const insights: string[] = [];
    const helpfulIds: string[] = [];
    const harmfulIds: string[] = [];

    if (runLog.schema !== "investor.daily-log.v1") {
      return { score: 0, feedback: [], metadata: { helpfulIds, harmfulIds } };
    }

    const report = runLog.report as z.infer<typeof DailyScenarioLogSchema>;
    const results = report.results?.backtest;

    if (!results || results.sharpe === undefined)
      return { score: 0, feedback: [], metadata: { helpfulIds, harmfulIds } };

    if (results.sharpe < 0.5) {
      insights.push(
        `Low Sharpe ratio (${results.sharpe.toFixed(2)}) detected. Strategy might be too volatile or trend-following in ranging market.`,
      );
    } else if (results.sharpe > 1.5) {
      insights.push(
        `Excellent Sharpe ratio (${results.sharpe.toFixed(2)}). Core alpha remains strong.`,
      );
    }

    return {
      score: results.sharpe,
      feedback: insights,
      metadata: { helpfulIds, harmfulIds },
    };
  }
}

/**
 * OpenCE: Processing Pillar
 * AceProcessor: Handles deduplication and semantic cleaning.
 */
export class AceProcessor implements IProcessor {
  async process(content: string): Promise<string> {
    // Current simple implementation: returning as-is
    return content;
  }
}

/**
 * OpenCE: Construction Pillar
 * AceConstructor: Assembles context into prompts.
 */
export class AceConstructor implements IConstructor {
  async construct(input: unknown, context: string[]): Promise<string> {
    const bulletList = context.map((c) => `- ${c}`).join("\n");
    return `Context:\n${bulletList}\n\nTask: ${JSON.stringify(input)}`;
  }
}

/**
 * OpenCE: Acquisition Pillar
 * AceAcquirer: Discovers and proposes new, high-value orthogonal strategies.
 */
export class AceAcquirer implements IAcquirer {
  /**
   * Proposes new strategy hypotheses based on market structural gaps.
   */
  async acquire(): Promise<string[]> {
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
 * AceEvolver: Manages the Playbook updates based on Evaluation signals.
 */
export class AceEvolver implements IEvolver {
  constructor(private playbook: ContextPlaybook) {}

  async evolve(signal: EvaluationResult): Promise<void> {
    const { feedback: insights, metadata } = signal;
    const helpfulIds = (metadata.helpfulIds as string[]) || [];
    const harmfulIds = (metadata.harmfulIds as string[]) || [];
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
