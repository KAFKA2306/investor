import { z } from "zod";

const YYYMMDD = z.string().regex(/^\d{8}$/);

export const PerformanceLedgerRowSchema = z.object({
  date: YYYMMDD,
  strategyId: z.string(),
  grossReturn: z.number(),
  netReturn: z.number(),
  benchmarkReturn: z.number().optional(),
  feeBps: z.number().min(0),
  slippageBps: z.number().min(0),
  totalCostBps: z.number().min(0),
  grossExposure: z.number().min(0),
  drawdown: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PerformanceLedgerRow = z.infer<typeof PerformanceLedgerRowSchema>;

export const PerformanceLedgerSchema = z.object({
  schema: z.literal("investor.performance-ledger.v1"),
  generatedAt: z.string().datetime(),
  rows: z.array(PerformanceLedgerRowSchema),
});

export type PerformanceLedger = z.infer<typeof PerformanceLedgerSchema>;
