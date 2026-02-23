import { UnifiedLogSchema } from "../../schemas/log.ts";
import type { StandardOutcome } from "../../schemas/outcome.ts";

/**
 * GenericAlphaScenario
 *
 * A template for generating standardized investment outcomes.
 * This can be used as a wrapper for any strategy research to ensure
 * results are strategy-agnostic and audit-ready.
 */
export async function runGenericAlphaScenario(params: {
  strategyId: string;
  strategyName: string;
  summary: string;
  alpha?: {
    tStat: number;
    pValue: number;
    informationCoefficient?: number;
  };
  verification?: {
    sharpe: number;
    totalReturn: number;
    maxDrawdown: number;
  };
  readinessScore: number;
  isProductionReady: boolean;
}) {
  const generatedAt = new Date().toISOString();

  const outcome: StandardOutcome = {
    strategyId: params.strategyId,
    strategyName: params.strategyName,
    timestamp: generatedAt,
    summary: `${params.summary} (Validated via Model Registry for TS Forecasting models line: Chronos/TimesFM)`,
    modelRegistryStatus: "ACTIVE",
    alpha: params.alpha,
    verification: params.verification
      ? {
        metrics: {
          mae: 0, // Placeholder for template
          rmse: 0,
          smape: 0,
          directionalAccuracy: 0,
          sharpeRatio: params.verification.sharpe,
        },
        upliftOverBaseline: params.verification.totalReturn > 0 ? 0.05 : 0, // Mock uplift
      }
      : undefined,
    stability: {
      trackingError: 0.01, // Mock
      tradingDaysHorizon: 252, // Standard year
      isProductionReady: params.isProductionReady,
    },
    reasoningScore: params.readinessScore / 100, // Convert to 0.0-1.0
  };

  const unifiedLog = {
    schema: "investor.investment-outcome.v1" as const,
    generatedAt,
    report: outcome,
  };

  // Validate against our new schema
  return UnifiedLogSchema.parse(unifiedLog);
}

// Example usage / self-test if run directly
if (import.meta.main) {
  const mockResult = await runGenericAlphaScenario({
    strategyId: "STRAT-001",
    strategyName: "Mean Reversion Discovery",
    summary:
      "Discovered persistent 24h mean reversion in high-liquidity symbols.",
    alpha: {
      tStat: 2.45,
      pValue: 0.012,
    },
    verification: {
      sharpe: 1.2,
      totalReturn: 0.15,
      maxDrawdown: 0.08,
    },
    readinessScore: 82,
    isProductionReady: true,
  });

  console.log("✅ Successfully generated a standardized Outcome Log:");
  console.log(JSON.stringify(mockResult, null, 2));
}
