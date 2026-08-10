import {
  type AlphaScreening,
  AlphaStatus,
  DEFAULT_EVALUATION_CRITERIA,
  type StandardOutcome,
  type StrategicReasoning,
  Verdict,
} from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * Strategic screening is still part of PipelineOrchestrator's public runtime
 * contract. The March cleanup removed this implementation while leaving the
 * live consumer in place. Keep this module dependency-light so restoring the
 * contract does not resurrect deleted provider stacks.
 */
export class StrategicReasonerAgent extends BaseAgent {
  public async reasonAboutAlpha(
    outcome: StandardOutcome,
    marketContext: string,
  ): Promise<StrategicReasoning> {
    logger.info(
      `[Council of Quants] Reasoning about alpha: ${outcome.strategyId}`,
    );

    const rawReasoning = outcome.reasoning || "";
    const extractedClaim =
      rawReasoning.match(/CLAIM:\s*(.*?)(?=\[REASONING\]|$)/)?.[1]?.trim() ||
      "General Alpha";

    const riskVerdict =
      Math.abs(outcome.verification?.metrics?.maxDrawdown ?? 0) >
      DEFAULT_EVALUATION_CRITERIA.performance.maxDrawdown
        ? Verdict.INVALID
        : Verdict.VALID;
    const hunterVerdict =
      (outcome.alpha?.pValue ?? 1) < DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue
        ? Verdict.VALID
        : Verdict.UNCERTAIN;
    const regimeVerdict =
      (marketContext.includes("BULL") &&
        extractedClaim.toLowerCase().includes("momentum")) ||
      (marketContext.includes("BEAR") &&
        extractedClaim.toLowerCase().includes("reversion")) ||
      marketContext.includes("UNCERTAIN")
        ? Verdict.VALID
        : Verdict.UNCERTAIN;

    const logicChecks: StrategicReasoning["logicChecks"] = [
      {
        claim: "Risk Manager Review",
        verdict: riskVerdict,
        evidence: `MaxDrawdown check: ${outcome.verification?.metrics?.maxDrawdown}.`,
      },
      {
        claim: "Alpha Hunter Review",
        verdict: hunterVerdict,
        evidence: `P-Value: ${outcome.alpha?.pValue} (Target < ${DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue}).`,
      },
      {
        claim: "Regime Specialist Review",
        verdict: regimeVerdict,
        evidence: `Alignment with ${marketContext} for ${extractedClaim}.`,
      },
    ];

    const validCount = logicChecks.filter(
      (check) => check.verdict === Verdict.VALID,
    ).length;
    return {
      rationale: `[Council Consensus] ${validCount}/3 specialist checks are VALID.`,
      logicChecks,
      contextAlignment: validCount / 3,
      marketRegime: marketContext,
    };
  }

  public async screenAlpha(
    outcome: StandardOutcome,
    reasoning: StrategicReasoning,
  ): Promise<AlphaScreening> {
    const sharpe = outcome.verification?.metrics?.sharpeRatio ?? 0;
    const pValue = outcome.alpha?.pValue ?? 1;
    let status = AlphaStatus.ACTIVE;
    let reason = "Alpha logic remains sound and performance is within expected range.";
    let score = reasoning.contextAlignment * 0.6 + (1 - pValue) * 0.4;

    if (
      sharpe < DEFAULT_EVALUATION_CRITERIA.performance.minSharpe ||
      pValue > DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue * 1.5
    ) {
      status = AlphaStatus.DECAYED;
      reason = `[REJECTED] Performance or significance too low. ${reasoning.rationale}`;
      score *= 0.5;
    } else if (reasoning.contextAlignment < 0.3) {
      status = AlphaStatus.INACTIVE;
      reason = `[INACTIVE] Specialist consensus too low. ${reasoning.rationale}`;
      score *= 0.8;
    }

    this.emitEvent("STRATEGY_DECIDED", {
      strategyId: outcome.strategyId,
      verdict: status,
      score,
      reason,
    });
    return { status, reason, lastUpdated: new Date().toISOString(), score };
  }

  public async run(): Promise<void> {
    logger.info("Alpha-R1 strategic reasoner ready");
  }
}
