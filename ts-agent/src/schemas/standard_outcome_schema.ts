import { z } from "zod";
import { MetricsSchema } from "./base.ts";

export const AlphaSignificanceSchema = z.object({
  tStat: z.number().optional(),
  pValue: z.number().min(0).max(1).optional(),
  informationCoefficient: z.number().min(-1).max(1).optional(),
  factorStability: z.number().optional(),
  numerai: z
    .object({
      corr: z.number().min(-1).max(1).optional(),
      mmc: z.number().min(-1).max(1).optional(),
      fnc: z.number().min(-1).max(1).optional(),
    })
    .optional(),
  famaFrench: z
    .object({
      mkt: z.number().optional(),
      smb: z.number().optional(),
      hml: z.number().optional(),
      rmw: z.number().optional(),
      cma: z.number().optional(),
    })
    .optional(),
});

export const VerificationPerformanceSchema = z.object({
  metrics: MetricsSchema,
  upliftOverBaseline: z.number().optional(),
  profitFactor: z.number().nonnegative().optional(),
});

export const OperationalStabilitySchema = z.object({
  trackingError: z.number().nonnegative(),
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
  reasoning: z.string().optional(),
  reasoningScore: z.number().min(0).max(1).optional(), // RS (0.0-1.0)
  modelRegistryStatus: z.string().optional(),
  experimentId: z.string().optional(), // [NEW] UQTL Lineage Bond
  evidenceSource: z.enum(["QUANT_BACKTEST", "LINGUISTIC_ONLY"]).optional(), // [NEW] Audit Source
  alpha: AlphaSignificanceSchema.optional(),
  verification: VerificationPerformanceSchema.optional(),
  stability: OperationalStabilitySchema.optional(),
  execution: ExecutionAuditSchema.optional(),
});

export type StandardOutcome = z.infer<typeof StandardOutcomeSchema>;
