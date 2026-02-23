import { z } from "zod";
import { MetricsSchema } from "./base.ts";

export const AlphaSignificanceSchema = z.object({
  tStat: z.number().optional(),
  pValue: z.number().min(0).max(1).optional(),
  informationCoefficient: z.number().min(-1).max(1).optional(),
  factorStability: z.number().optional(), // decay rate or autocorrelation
});

export const VerificationPerformanceSchema = z.object({
  metrics: MetricsSchema,
  upliftOverBaseline: z.number().optional(),
  profitFactor: z.number().nonnegative().optional(),
});

export const OperationalReadinessSchema = z.object({
  readinessScore: z.number().min(0).max(100),
  tradingDaysHorizon: z.number().int().nonnegative(),
  isProductionReady: z.boolean(),
});

export const ExecutionAuditSchema = z.object({
  totalPnL: z.number(),
  trackingError: z.number().nonnegative().optional(),
  slippageImpactBps: z.number().nonnegative().optional(),
});

export const StandardOutcomeSchema = z.object({
  strategyId: z.string(),
  strategyName: z.string(),
  timestamp: z.string().datetime(),
  summary: z.string(),
  modelRegistryStatus: z.string().optional(),
  alpha: AlphaSignificanceSchema.optional(),
  verification: VerificationPerformanceSchema.optional(),
  readiness: OperationalReadinessSchema.optional(),
  execution: ExecutionAuditSchema.optional(),
});

export type StandardOutcome = z.infer<typeof StandardOutcomeSchema>;
