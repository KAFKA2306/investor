import { z } from "zod";

export const PeadAnalysisSchema = z.object({
  symbol: z.string().length(4),
  sue: z.number(),
  sentimentScore: z.number().min(-1).max(1),
  isSurprise: z.boolean(),
  targetPrice: z.number().positive(),
  analyzedAt: z.string().datetime(),
});

export type PeadAnalysis = z.infer<typeof PeadAnalysisSchema>;
