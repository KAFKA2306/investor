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
    const riskEvidence = `MaxDrawdown check: ${outcome.verification?.metrics?.maxDrawdown}.`;

    const hunterVerdict =
      (outcome.alpha?.pValue ?? 1) < DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue
        ? Verdict.VALID
        : Verdict.UNCERTAIN;
    const hunterEvidence = `P-Value: ${outcome.alpha?.pValue} (Target < ${DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue}).`;

    const regimeVerdict =
      (marketContext.includes("BULL") &&
        extractedClaim.toLowerCase().includes("momentum")) ||
      (marketContext.includes("BEAR") &&
        extractedClaim.toLowerCase().includes("reversion")) ||
      marketContext.includes("UNCERTAIN")
        ? Verdict.VALID
        : Verdict.UNCERTAIN;
    const regimeEvidence = `Alignment with ${marketContext} for ${extractedClaim}.`;

    const logicChecks: StrategicReasoning["logicChecks"] = [
      {
        claim: "Risk Manager Review",
        verdict: riskVerdict,
        evidence: riskEvidence,
      },
      {
        claim: "Alpha Hunter Review",
        verdict: hunterVerdict,
        evidence: hunterEvidence,
      },
      {
        claim: "Regime Specialist Review",
        verdict: regimeVerdict,
        evidence: regimeEvidence,
      },
    ];

    const validCount = logicChecks.filter(
      (c) => c.verdict === Verdict.VALID,
    ).length;
    const contextAlignment = validCount / 3;

    const rationale = `[Council Consensus] The alpha was reviewed by the Risk Manager, Alpha Hunter, and Regime Specialist. 
    Final Verdict Count: ${validCount}/3 VALID. 
    Key Critique: ${validCount < 3 ? "One or more specialists raised concerns about robustness or risk." : "Unanimous approval."}`;

    return {
      rationale,
      logicChecks,
      contextAlignment,
      marketRegime: marketContext,
    };
  }

  public async screenAlpha(
    outcome: StandardOutcome,
    reasoning: StrategicReasoning,
  ): Promise<AlphaScreening> {
    logger.info(`[Alpha-R1] Screening alpha: ${outcome.strategyId}`);

    const sharpe = outcome.verification?.metrics?.sharpeRatio ?? 0;
    const pValue = outcome.alpha?.pValue ?? 1.0;

    let status = AlphaStatus.ACTIVE;
    let reason =
      "Alpha logic remains sound and performance is within expected range.";
    let score = reasoning.contextAlignment * 0.6 + (1 - pValue) * 0.4;

    if (
      sharpe < DEFAULT_EVALUATION_CRITERIA.performance.minSharpe ||
      pValue > DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue * 1.5
    ) {
      status = AlphaStatus.DECAYED;
      reason = `[REJECTED] Performance or Significance too low. ${reasoning.rationale}`;
      score *= 0.5;
    } else if (reasoning.contextAlignment < 0.3) {
      status = AlphaStatus.INACTIVE;
      reason = `[INACTIVE] Specialist consensus too low. ${reasoning.rationale}`;
      score *= 0.8;
    }

    const screening = {
      status,
      reason,
      lastUpdated: new Date().toISOString(),
      score,
    };

    this.emitEvent("STRATEGY_DECIDED", {
      strategyId: outcome.strategyId,
      verdict: status,
      score: screening.score,
      reason: screening.reason,
    });

    return screening;
  }

  public async run(): Promise<void> {
    logger.info("🎀 Alpha-R1: Strategic Reasoner is standing by...");
  }
}
