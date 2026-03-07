import {
  AlphaStatus,
  type StandardOutcome,
  Verdict,
} from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";
import { LesAgent } from "./latent_economic_signal_agent.ts";

// 📌 AAARTS拡張: 8つの評価視点を含むAuditReport
export interface EvaluationViewpoint {
  observation: string; // 観測: 実測データ・指標
  interpretation: string; // 解釈: データの意味
  hypothesis: string; // 仮説: テストされた仮説
  assumptions: string; // 前提: 前提条件
  constraints: string; // 制約: 運用上の制約
  risks: string; // リスク: 潜在的リスク
  nextSteps: string; // 次の一手: 改善方向
}

export interface AuditReport {
  strategyId: string;
  timestamp: string;
  // 📌 AAARTS: GO/HOLD/PIVOT判定
  verdict: "GO" | "HOLD" | "PIVOT" | "APPROVED" | "REJECTED" | "REQUIRES_FIX"; // 後方互換性のため両方サポート
  scores: {
    alphaStability: number;
    riskAdjustedReturn: number;
  };
  critique: string[];
  isProductionReady: boolean;
  // 📌 AAARTS: 8視点評価チェックリスト
  evaluationViewpoints?: EvaluationViewpoint;
  aaartesVerdictRationale?: string; // GO/HOLD/PIVOT判定の根拠
}

export class CqoAgent extends BaseAgent {
  public auditStrategy(outcome: StandardOutcome): AuditReport {
    logger.info(
      `[CQO] Critical Audit starting for strategy: ${outcome.strategyId}...`,
    );

    const crit = LesAgent.EVALUATION_CRITERIA;
    const a = outcome.alpha;
    const m = outcome.verification?.metrics;

    const critique: string[] = [];

    const tStat = m?.tStat ?? 0;
    const pValue = a?.pValue ?? m?.pValue ?? 1.0;

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

    const r1 = outcome.strategicReasoning;
    const screening = outcome.alphaScreening;

    if (r1) {
      const invalidChecks = r1.logicChecks.filter(
        (c) => c.verdict === Verdict.INVALID,
      );
      if (invalidChecks.length > 0) {
        critique.push(
          `[Alpha-R1] Strategic logic violation: ${invalidChecks.map((c) => c.claim).join(", ")}`,
        );
      }
    }

    if (screening && screening.status !== AlphaStatus.ACTIVE) {
      critique.push(
        `[Alpha-R1] Screening status is ${screening.status}: ${screening.reason}`,
      );
    }

    const isProductionReady =
      critique.length === 0 &&
      (outcome.stability?.isProductionReady ?? false) &&
      screening?.status === AlphaStatus.ACTIVE;

    // 📌 AAARTS: GO/HOLD/PIVOT判定ロジック
    const goCriteria = {
      allGatesPass: critique.length === 0,
      productionReady: isProductionReady,
      logicValid:
        !r1 || r1.logicChecks.every((c) => c.verdict !== Verdict.INVALID),
      screeningActive: screening?.status === AlphaStatus.ACTIVE,
      sharpeAcceptable: sharpe >= crit.PERFORMANCE.minSharpe,
      pValueAcceptable: pValue <= crit.ALPHA.maxPValue,
      drawdownAcceptable: maxDD <= crit.PERFORMANCE.maxDrawdown,
    };

    const goCheckCount = Object.values(goCriteria).filter(Boolean).length;

    // 📌 AAARTS: Sharpe-weighted Vote の導入
    let aaartesVerdict: "GO" | "HOLD" | "PIVOT" = "PIVOT";
    let verdictRationale = "Initial default state";

    // Sharpe による投票権の重み付け (Sharpe-weighted Confidence)
    const sharpeWeight = Math.min(
      2.0,
      Math.max(0.5, sharpe / (crit.PERFORMANCE.minSharpe || 1.8)),
    );
    const weightedPassCount = goCheckCount * sharpeWeight;

    if (goCheckCount === 7) {
      aaartesVerdict = "GO";
      verdictRationale = `All 7 evaluation criteria passed with a Sharpe-weighted confidence of ${sharpeWeight.toFixed(2)}x: immediate execution recommended.`;
    }
    // HOLD判定: 軽微な懸念（Weighted 4.0以上、かつ 4項目以上クリア）
    else if (weightedPassCount >= 4.0 && goCheckCount >= 4) {
      aaartesVerdict = "HOLD";
      verdictRationale = `${goCheckCount}/7 criteria passed (Weighted Confidence: ${weightedPassCount.toFixed(2)}): minor issues detected. Sharpe-weighted vote suggests potential for refinement.`;
    }
    // PIVOT判定: 根本的問題
    else {
      aaartesVerdict = "PIVOT";
      verdictRationale = `Insufficient validation (Weighted Confidence: ${weightedPassCount.toFixed(2)}): fundamental issues detected. Direction change recommended.`;
    }

    // 📌 AAARTS: 8視点評価チェックリスト
    const evaluationViewpoints: EvaluationViewpoint = {
      observation: `Sharpe=${sharpe.toFixed(2)}, MaxDD=${(maxDD * 100).toFixed(1)}%, T-Stat=${tStat.toFixed(2)}, P-Value=${pValue.toFixed(4)}`,
      interpretation: `Risk-adjusted performance: ${
        sharpe >= crit.PERFORMANCE.minSharpe ? "sufficient" : "insufficient"
      }. Tail risk: ${
        maxDD <= crit.PERFORMANCE.maxDrawdown ? "controlled" : "excessive"
      }.`,
      hypothesis: outcome.summary || "Alpha hypothesis under review",
      assumptions: `Assumes ${crit.ALPHA.minTStat}+ t-stat threshold, ${
        crit.PERFORMANCE.minSharpe
      } minimum Sharpe, ${(crit.PERFORMANCE.maxDrawdown * 100).toFixed(1)}% max drawdown`,
      constraints: `Portfolio-level: max positions ${outcome.stability?.trackingError?.toFixed(3) ?? "N/A"}. Execution: ${
        isProductionReady ? "ready" : "not ready"
      }. Horizon: ${outcome.stability?.tradingDaysHorizon ?? "N/A"} days`,
      risks:
        critique.length > 0
          ? critique.join("; ")
          : "No critical risks identified at audit time",
      nextSteps:
        aaartesVerdict === "GO"
          ? "Execute immediately with standard risk controls"
          : aaartesVerdict === "HOLD"
            ? "Refine strategy parameters or gather additional validation data"
            : "Redesign strategy with alternative factor set or market regime focus",
    };

    const audit: AuditReport = {
      strategyId: outcome.strategyId,
      timestamp: new Date().toISOString(),
      verdict: aaartesVerdict,
      scores: {
        alphaStability: tStat / crit.ALPHA.minTStat,
        riskAdjustedReturn: sharpe / crit.PERFORMANCE.minSharpe,
      },
      critique,
      isProductionReady,
      evaluationViewpoints,
      aaartesVerdictRationale: verdictRationale,
    };

    this.emitEvent("AUDIT_COMPLETED", {
      strategyId: audit.strategyId,
      verdict: audit.verdict,
      isProductionReady: audit.isProductionReady,
    });

    return audit;
  }

  public generateAuditMarkdown(audit: AuditReport): string {
    const statusIcon =
      audit.verdict === "GO" || audit.verdict === "APPROVED"
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

## 3. Deployment Recommendation
**Production Ready**: ${audit.isProductionReady ? "**YES** - Proceed to execution stage." : "**NO** - Back to research/backtest phase."}

---
*CQO Audit signed by Antigravity AI*
`;
  }

  public async run(): Promise<void> {
    logger.info("💼 CQO: Auditor standing by for strategy review...");
  }
}
