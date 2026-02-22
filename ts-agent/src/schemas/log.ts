import { z } from "zod";
import { KabuOrderSchema } from "./kabucom";
import { PeadAnalysisSchema } from "./pead";

export const RiskEntrySchema = z.object({
  strategyId: z.string(),
  kellyFraction: z.number().min(0).max(1),
  lotSize: z.number().int().nonnegative(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  decidedAt: z.string().datetime(),
});

export const ResultEntrySchema = z.object({
  symbol: z.string().length(4),
  orderId: z.string().optional(),
  status: z.enum(["SUCCESS", "FAIL"]),
  executedPrice: z.number().positive().optional(),
  pnl: z.number().optional(),
  error: z.string().optional(),
  executedAt: z.string().datetime(),
});

export const UnifiedLogSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  version: z.string(),
  generatedAt: z.string().datetime(),
  signals: z.array(PeadAnalysisSchema),
  risks: z.array(RiskEntrySchema),
  orders: z.array(KabuOrderSchema),
  results: z.array(ResultEntrySchema),
  optimization: z.object({
    thresholdAdjustments: z.record(z.string(), z.number()),
    promptUpdates: z.array(z.string()),
  }),
});

export type UnifiedLog = z.infer<typeof UnifiedLogSchema>;
export type RiskEntry = z.infer<typeof RiskEntrySchema>;
export type ResultEntry = z.infer<typeof ResultEntrySchema>;
