import { z } from "zod";

export const DailyLogSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  strategyReturn: z.number(),
  benchmarkReturn: z.number().optional(),
});

export type DailyLog = z.infer<typeof DailyLogSchema>;

export const EvaluationResultSchema = z.object({
  sampleSize: z.number().int().nonnegative(), // Added for continuity
  cumulativeReturn: z.number(),
  cagr: z.number(),
  sharpe: z.number(),
  maxDrawdown: z.number(),
  winRate: z.number(),
  avgReturn: z.number(),
  volatility: z.number(),
  profitFactor: z.number().optional(), // Added for completeness
  informationRatio: z.number().optional(),
  informationCoefficient: z.number().optional(), // IC (Pearson correlation)
});

export const ExecutionAuditSchema = z.object({
  theoreticalCostBps: z.number(),
  realizedCostBps: z.number().optional(),
  slippageImpact: z.number(),
  executionEfficiency: z.number(), // (Theoretical / Realized) or similar
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
