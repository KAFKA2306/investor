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

export const VerificationLayoutSchema = z.object({
  mainTitle: z.string(),
  subTitle: z.string(),
  panel1Title: z.string(),
  panel2Title: z.string(),
  panel3Title: z.string(),
  panel4Title: z.string(),
  yAxisReturn: z.string(),
  yAxisSignal: z.string(),
  legendStrategy: z.string(),
  legendBenchmark: z.string(),
});

export const ExecutionCostsSchema = z.object({
  feeBps: z.number().nonnegative(),
  slippageBps: z.number().nonnegative(),
  totalCostBps: z.number().nonnegative(),
});

export const QuantitativeVerificationSchema = z.object({
  schemaVersion: z.string().default("1.1.0"),
  strategyId: z.string(),
  strategyName: z.string(),
  description: z.string(),
  generatedAt: z.string().datetime(),
  audit: z.object({
    commitHash: z.string(),
    environment: z.string(),
  }),
  fileName: z.string(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)), // [課題2] 日付形式の強制
  strategyCum: z.array(z.number()),
  benchmarkCum: z.array(z.number()),
  individualData: z.record(z.string(), SymbolTimeSeriesSchema),
  metrics: VerificationMetricsSchema,
  costs: ExecutionCostsSchema, // [課題9] コスト構造の追加
  layout: VerificationLayoutSchema,
});

export type QuantitativeVerification = z.infer<typeof QuantitativeVerificationSchema>;
