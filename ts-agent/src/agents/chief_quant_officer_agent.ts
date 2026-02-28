import type { StandardOutcome } from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { LesAgent } from "./latent_economic_signal_agent.ts";

export interface AuditReport {
  strategyId: string;
  timestamp: string;
  verdict: "APPROVED" | "REJECTED" | "REQUIRES_FIX";
  scores: {
    alphaStability: number;
    riskAdjustedReturn: number;
    reasoningScore: number;
  };
  critique: string[];
  isProductionReady: boolean;
}

/**
 * CQO Agent (Chief Quantitative Officer)
 *
 * The ultimate "gatekeeper" of the quantitative research pipeline.
 * Performs rigorous critical auditing of strategy outcomes.
 */
export class CqoAgent extends BaseAgent {
  /**
   * Performs a critical audit of a strategy outcome.
   */
  public auditStrategy(outcome: StandardOutcome): AuditReport {
    console.log(
      `[CQO] Critical Audit starting for strategy: ${outcome.strategyId}...`,
    );

    const crit = LesAgent.EVALUATION_CRITERIA;
    const a = outcome.alpha;
    const m = outcome.verification?.metrics;

    const critique: string[] = [];

    // 1. Alpha Significance Check
    const tStat = a?.tStat ?? 0;
    const pValue = a?.pValue ?? 1.0;
    const ic = a?.informationCoefficient ?? 0;

    if (tStat < crit.ALPHA.minTStat) {
      critique.push(
        `Lower than acceptable t-stat (${tStat.toFixed(2)} < ${crit.ALPHA.minTStat}). Alpha might be noise.`,
      );
    }
    if (pValue > crit.ALPHA.maxPValue) {
      critique.push(
        `P-value too high (${pValue.toFixed(4)} > ${crit.ALPHA.maxPValue}). Probability of random profit is excessive.`,
      );
    }
    if (ic < crit.ALPHA.minIC) {
      critique.push(
        `Information Coefficient (IC) is weak (${ic.toFixed(3)} < ${crit.ALPHA.minIC}). Weak forecasting edge.`,
      );
    }

    // 2. Risk/Return Check
    const sharpe = m?.sharpeRatio ?? 0;
    const maxDD = m?.maxDrawdown ?? 1.0;

    if (sharpe < crit.PERFORMANCE.minSharpe) {
      critique.push(
        `Target Sharpe Ratio not met (${sharpe.toFixed(2)} < ${crit.PERFORMANCE.minSharpe}). Strategy lacks risk-adjusted excellence.`,
      );
    }
    if (maxDD > crit.PERFORMANCE.maxDrawdown) {
      critique.push(
        `Maximum Drawdown exceeds policy (${(maxDD * 100).toFixed(1)}% > ${(crit.PERFORMANCE.maxDrawdown * 100).toFixed(1)}%). Risk profile is too aggressive.`,
      );
    }

    // 3. Reasoning quality
    const reasoningScore = outcome.reasoningScore ?? 0;
    if (reasoningScore < crit.REASONING.minRS) {
      critique.push(
        `Low reasoning score (${reasoningScore.toFixed(2)} < ${crit.REASONING.minRS}). Hypothesis logic is not robust.`,
      );
    }

    const isProductionReady =
      critique.length === 0 && (outcome.stability?.isProductionReady ?? false);

    let verdict: AuditReport["verdict"] = "APPROVED";
    if (critique.length > 3) verdict = "REJECTED";
    else if (critique.length > 0) verdict = "REQUIRES_FIX";

    return {
      strategyId: outcome.strategyId,
      timestamp: new Date().toISOString(),
      verdict,
      scores: {
        alphaStability: tStat / crit.ALPHA.minTStat,
        riskAdjustedReturn: sharpe / crit.PERFORMANCE.minSharpe,
        reasoningScore: reasoningScore,
      },
      critique,
      isProductionReady,
    };
  }

  /**
   * Generates a formal audit report in Markdown format.
   */
  public generateAuditMarkdown(audit: AuditReport): string {
    const statusIcon =
      audit.verdict === "APPROVED"
        ? "✅"
        : audit.verdict === "REJECTED"
          ? "❌"
          : "⚠️";

    return `# CQO Audit Report: ${audit.strategyId}
    
**Audit Date**: ${audit.timestamp.split("T")[0]}
**Role**: Chief Quantitative Officer (Critical Critic)
**Verdict**: **${audit.verdict} ${statusIcon}**

## 1. Quantitative Critique
${audit.critique.length > 0 ? audit.critique.map((c) => `- ${c}`).join("\n") : "- No critical issues found. All quantitative gates passed."}

## 2. Audit Scores (Normalized to Thresholds)
- **Alpha Stability**: ${audit.scores.alphaStability.toFixed(2)}x
- **Risk-Adjusted Return**: ${audit.scores.riskAdjustedReturn.toFixed(2)}x
- **Reasoning Quality**: ${(audit.scores.reasoningScore * 100).toFixed(1)}%

## 3. Deployment Recommendation
**Production Ready**: ${audit.isProductionReady ? "**YES** - Proceed to execution stage." : "**NO** - Back to research/backtest phase."}

---
*CQO Audit signed by Antigravity AI*
`;
  }

  public async run(): Promise<void> {
    console.log("💼 CQO: Auditor standing by for strategy review...");
  }
}
