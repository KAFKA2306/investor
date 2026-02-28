import { z } from "zod";
import type { PerformanceMetrics } from "../evaluate/performance_metrics.ts";

export const PromotionGateInputSchema = z.object({
  readiness: z.object({
    sampleSize: z.number().int().nonnegative(),
    totalScore: z.number(),
    verdict: z.enum(["NOT_READY", "CAUTION", "READY"]),
  }),
  performance: z.object({
    sharpe: z.number(),
    maxDrawdown: z.number(),
    sampleSize: z.number().int().nonnegative(),
    cumulativeReturn: z.number(),
    winRate: z.number(),
  }),
  ledgerQuality: z.object({
    rowCount: z.number().int().nonnegative(),
    missingCostRows: z.number().int().nonnegative(),
    missingExposureRows: z.number().int().nonnegative(),
  }),
});

export type PromotionGateInput = z.infer<typeof PromotionGateInputSchema>;

export const PromotionDecisionSchema = z.object({
  decision: z.enum([
    "REJECT",
    "SHADOW_ONLY",
    "PAPER_ALLOCATE",
    "LIVE_ALLOCATE",
  ]),
  allocationTier: z.number().int().min(0).max(3),
  targetGrossExposureMultiplier: z.number().min(0),
  riskBudgetBps: z.number().min(0),
  reasons: z.array(z.string()),
});

export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>;

export function toPromotionInput(params: {
  readinessReport: {
    sampleSize: number;
    score: {
      total: number;
    };
    verdict: "NOT_READY" | "CAUTION" | "READY";
  };
  candidateMetrics: PerformanceMetrics;
  ledgerQuality: {
    rowCount: number;
    missingCostRows: number;
    missingExposureRows: number;
  };
}): PromotionGateInput {
  const { readinessReport, candidateMetrics, ledgerQuality } = params;
  return PromotionGateInputSchema.parse({
    readiness: {
      sampleSize: readinessReport.sampleSize,
      totalScore: readinessReport.score.total,
      verdict: readinessReport.verdict,
    },
    performance: {
      sharpe: candidateMetrics.sharpe,
      maxDrawdown: candidateMetrics.maxDrawdown,
      sampleSize: candidateMetrics.sampleSize,
      cumulativeReturn: candidateMetrics.cumulativeReturn,
      winRate: candidateMetrics.winRate,
    },
    ledgerQuality,
  });
}

export function evaluatePromotionGate(
  inputRaw: PromotionGateInput,
): PromotionDecision {
  const input = PromotionGateInputSchema.parse(inputRaw);
  const reasons: string[] = [];

  const sampleSize = Math.min(
    input.readiness.sampleSize,
    input.performance.sampleSize,
    input.ledgerQuality.rowCount,
  );

  if (sampleSize < 252) {
    reasons.push(
      "sampleSize < 252; only research/shadow operation is allowed.",
    );
    return PromotionDecisionSchema.parse({
      decision: "REJECT",
      allocationTier: 0,
      targetGrossExposureMultiplier: 0,
      riskBudgetBps: 0,
      reasons,
    });
  }

  if (input.readiness.totalScore < 75 || input.readiness.verdict !== "READY") {
    reasons.push("readiness score/verdict is below production threshold.");
    return PromotionDecisionSchema.parse({
      decision: "SHADOW_ONLY",
      allocationTier: 1,
      targetGrossExposureMultiplier: 0,
      riskBudgetBps: 0,
      reasons,
    });
  }

  if (input.performance.maxDrawdown < -0.1) {
    reasons.push("maxDrawdown breached 10% loss limit.");
    return PromotionDecisionSchema.parse({
      decision: "SHADOW_ONLY",
      allocationTier: 1,
      targetGrossExposureMultiplier: 0,
      riskBudgetBps: 0,
      reasons,
    });
  }

  if (input.performance.sharpe < 1.0) {
    reasons.push("sharpe < 1.0 after net-of-cost evaluation.");
    return PromotionDecisionSchema.parse({
      decision: "PAPER_ALLOCATE",
      allocationTier: 1,
      targetGrossExposureMultiplier: 0.25,
      riskBudgetBps: 25,
      reasons,
    });
  }

  if (input.ledgerQuality.missingCostRows > 0) {
    reasons.push("missing cost rows detected in canonical ledger.");
    return PromotionDecisionSchema.parse({
      decision: "PAPER_ALLOCATE",
      allocationTier: 1,
      targetGrossExposureMultiplier: 0.25,
      riskBudgetBps: 25,
      reasons,
    });
  }

  if (input.performance.sharpe < 1.5) {
    reasons.push(
      "sharpe is acceptable for paper but below live-allocation bar.",
    );
    return PromotionDecisionSchema.parse({
      decision: "PAPER_ALLOCATE",
      allocationTier: 2,
      targetGrossExposureMultiplier: 0.5,
      riskBudgetBps: 50,
      reasons,
    });
  }

  reasons.push(
    "all hard gates passed; eligible for controlled live allocation.",
  );
  return PromotionDecisionSchema.parse({
    decision: "LIVE_ALLOCATE",
    allocationTier: 3,
    targetGrossExposureMultiplier: 1,
    riskBudgetBps: 100,
    reasons,
  });
}
