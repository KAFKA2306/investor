import {
  type AlphaScreening,
  AlphaStatus,
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
      (outcome.verification?.metrics?.maxDrawdown ?? 0) < -0.2
        ? Verdict.INVALID
        : Verdict.VALID;
    const riskEvidence = `MaxDrawdown check: ${outcome.verification?.metrics?.maxDrawdown}.`;

    const hunterVerdict =
      (outcome.alpha?.pValue ?? 1) < 0.05 ? Verdict.VALID : Verdict.UNCERTAIN;
    const hunterEvidence = `P-Value: ${outcome.alpha?.pValue}.`;

    const regimeVerdict =
      marketContext.includes("BULL") &&
      extractedClaim.toLowerCase().includes("momentum")
        ? Verdict.VALID
        : Verdict.UNCERTAIN;
    const regimeEvidence = `Alignment with ${marketContext}.`;

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

    if (sharpe < 0.5 || pValue > 0.1) {
      status = AlphaStatus.DECAYED;
      reason = `[REJECTED] ${reasoning.rationale}`;
      score *= 0.5;
    } else if (reasoning.contextAlignment < 0.5) {
      status = AlphaStatus.INACTIVE;
      reason = `[INACTIVE] ${reasoning.rationale}`;
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
