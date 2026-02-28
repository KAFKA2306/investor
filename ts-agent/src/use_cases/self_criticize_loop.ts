import { type AuditReport, CqoAgent } from "../agents/cqo.ts";
import { LesAgent } from "../agents/les.ts";
import type { StandardOutcome } from "../schemas/outcome.ts";

export class SelfCriticizeLoop {
  private lesAgent = new LesAgent();
  private cqoAgent = new CqoAgent();

  /**
   * Runs the iterative refinement loop.
   */
  public async run(
    strategyId: string,
    maxIterations = 3,
  ): Promise<AuditReport> {
    console.log(
      `\n🔄 [LOOP] Starting Self-Criticize Loop for ${strategyId}...`,
    );

    let currentFeedback: string[] = [];
    let lastReport: AuditReport | undefined;

    for (let i = 0; i < maxIterations; i++) {
      console.log(`\n--- Iteration ${i + 1}/${maxIterations} ---`);

      // 1. Generate/Refine Factors
      const factors = await this.lesAgent.generateAlphaFactors({
        feedback: currentFeedback,
        targetDiversity: "MEDIUM",
      });
      console.log(`[LOOP] Generated ${factors.length} candidate factors.`);

      // Simulation: We assume at least one candidate is produced
      // In a real run, this would be the actual backtest outcome of the new factor
      const mockOutcome = await this.simulateOutcome(
        strategyId,
        i,
        currentFeedback,
      );

      // 2. Critical Audit
      const report = this.cqoAgent.auditStrategy(mockOutcome);
      lastReport = report;

      console.log(`[LOOP] Verdict: ${report.verdict}`);

      if (report.verdict === "APPROVED") {
        console.log("✅ [LOOP] Strategy approved by CQO!");
        return report;
      }

      // 3. Feedback Loop
      console.log(
        "⚠️ [LOOP] Strategy rejected. Feeding critique back for refinement...",
      );
      currentFeedback = report.critique;
    }

    console.log("❌ [LOOP] Max iterations reached without approval.");
    return lastReport!;
  }

  /**
   * Simulates a strategy outcome that improves over time based on feedback.
   */
  private async simulateOutcome(
    id: string,
    iteration: number,
    feedback: string[],
  ): Promise<StandardOutcome> {
    // Improvement simulation: Each iteration gets better (if feedback is acted upon)
    const baseSharpe = 0.8 + iteration * 0.4;
    const baseTStat = 1.2 + iteration * 0.5;

    return {
      strategyId: id,
      strategyName: "Iterative Alpha Discovery",
      timestamp: new Date().toISOString(),
      summary: `Simulation-only iteration ${iteration} acting on ${feedback.length} feedback items. Not backed by market backtest evidence.`,
      evidenceSource: "LINGUISTIC_ONLY",
      reasoningScore: 0.6 + iteration * 0.1,
      alpha: {
        tStat: baseTStat,
        pValue: Math.max(0.01, 0.1 - iteration * 0.04),
        informationCoefficient: 0.02 + iteration * 0.01,
      },
      verification: {
        metrics: {
          sharpeRatio: baseSharpe,
          maxDrawdown: Math.max(0.05, 0.15 - iteration * 0.03),
          annualizedReturn: 0.1,
          directionalAccuracy: 0.52,
          mae: 0,
          rmse: 0,
          smape: 0,
        },
        upliftOverBaseline: 0,
      },
      stability: {
        trackingError: 0.02,
        tradingDaysHorizon: 252,
        isProductionReady: iteration >= 2, // Becomes ready eventually
      },
    };
  }
}
