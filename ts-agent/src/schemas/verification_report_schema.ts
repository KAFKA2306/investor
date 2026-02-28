import { z } from "zod";

export const SymbolTimeSeriesSchema = z.object({
  prices: z.array(z.number()),
  factors: z.array(z.number()),
  positions: z.array(z.number()),
});

export const VerificationMetricsSchema = z.object({
  ic: z.number(),
  sharpe: z.number(),
  maxDD: z.number(),
  totalReturn: z.number(),
  universe: z.array(z.string()),
});

export const QuantitativeVerificationSchema = z.object({
  strategyId: z.string(),
  strategyName: z.string(),
  description: z.string(),
  generatedAt: z.string().datetime(),
  dates: z.array(z.string()),
  strategyCum: z.array(z.number()),
  benchmarkCum: z.array(z.number()),
  individualData: z.record(z.string(), SymbolTimeSeriesSchema),
  metrics: VerificationMetricsSchema,
});

export type QuantitativeVerification = z.infer<typeof QuantitativeVerificationSchema>;
