import { z } from "zod";
import { KabuOrderSchema } from "./kabucom";
import { MarketRegimeSchema } from "./market";
import { PeadAnalysisSchema } from "./pead";

export const UnifiedLogSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string(),
  regime: MarketRegimeSchema,
  signals: z.array(PeadAnalysisSchema),
  orders: z.array(KabuOrderSchema),
  optimization: z
    .object({
      thresholdAdjustments: z.record(z.string(), z.number()),
      promptUpdates: z.array(z.string()),
    })
    .optional(),
});

export type UnifiedLog = z.infer<typeof UnifiedLogSchema>;
