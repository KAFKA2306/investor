import { z } from "zod";

export const MarketRegimeSchema = z.object({
  regime: z.enum(["BULL", "BEAR", "STORM", "CALM"]),
  volatility: z.number().nonnegative(),
  trendScore: z.number(),
  riskMultiplier: z.number().min(0).max(1),
  updatedAt: z.string().datetime(),
});

export type MarketRegime = z.infer<typeof MarketRegimeSchema>;
