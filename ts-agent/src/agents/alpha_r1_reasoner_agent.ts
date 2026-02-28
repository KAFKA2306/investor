import type { StandardOutcome, StrategicReasoning, AlphaScreening } from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";

/**
 * StrategicReasonerAgent (Alpha-R1)
 *
 * Implements "Alpha Screening with LLM Reasoning" (arXiv:2512.23515).
 * Acts as a 8B-class strategic thinker that checks the logical validity
 * of alphas against current market context.
 */
export class StrategicReasonerAgent extends BaseAgent {
  /**
   * Performs strategic reasoning on an alpha outcome.
   * This mimics the "Strategic Reasoner" from Alpha-R1.
   */
  public async reasonAboutAlpha(
    outcome: StandardOutcome,
    marketContext: string
  ): Promise<StrategicReasoning> {
    console.log(`[Alpha-R1] Reasoning about alpha: ${outcome.strategyId} in context: ${marketContext}`);

    // Simplified logic for simulation:
    // In production, this would call an 8B LLM with a specific prompt.
    const rationale = `Alpha ${outcome.strategyId} is being evaluated against context: ${marketContext}. 
    The logic focuses on ${outcome.summary}. Given the current regime, the alignment appears strong but requires structural monitoring.`;

    const logicChecks: StrategicReasoning["logicChecks"] = [
      {
        claim: "Alpha captures mean-reversion during high volatility",
        verdict: marketContext.includes("VOLATILE") ? "VALID" : "UNCERTAIN",
        evidence: "Historical IC peaks during high VIX regimes."
      },
      {
        claim: "Alpha is orthogonal to momentum factor",
        verdict: "VALID",
        evidence: "Correlation with Trend-following indices is < 0.15."
      }
    ];

    const contextAlignment = marketContext.includes("MOMENTUM") ? 0.85 : 0.45;

    return {
      rationale,
      logicChecks,
      contextAlignment,
      marketRegime: marketContext
    };
  }

  /**
   * Performs Context-Aware Screening.
   * Decisions whether to keep an alpha ACTIVE or switch it to INACTIVE/DECAYED.
   */
  public async screenAlpha(
    outcome: StandardOutcome,
    reasoning: StrategicReasoning
  ): Promise<AlphaScreening> {
    console.log(`[Alpha-R1] Screening alpha: ${outcome.strategyId}`);

    const sharpe = outcome.verification?.metrics?.sharpeRatio ?? 0;
    const pValue = outcome.alpha?.pValue ?? 1.0;
    
    let status: AlphaScreening["status"] = "ACTIVE";
    let reason = "Alpha logic remains sound and performance is within expected range.";
    let score = reasoning.contextAlignment * 0.6 + (1 - pValue) * 0.4;

    if (sharpe < 0.5 || pValue > 0.1) {
      status = "DECAYED";
      reason = "Statistically significant performance decay detected.";
      score *= 0.5;
    } else if (reasoning.contextAlignment < 0.5) {
      status = "INACTIVE";
      reason = "Alpha logic is currently misaligned with the prevailing market regime.";
      score *= 0.8;
    }

    const screening = {
      status,
      reason,
      lastUpdated: new Date().toISOString(),
      score
    };

    this.emitEvent("STRATEGY_DECIDED", {
      strategyId: outcome.strategyId,
      verdict: status,
      score: screening.score,
      reason: screening.reason
    });

    return screening;
  }

  public async run(): Promise<void> {
    console.log("🎀 Alpha-R1: Strategic Reasoner is standing by...");
  }
}
