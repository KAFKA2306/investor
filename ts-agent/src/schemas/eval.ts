import { z } from "zod";

export const StrategyEvalSchema = z.object({
  strategyName: z.string(),
  performance: z.object({
    expectedAnnualReturn: z.number(),
    maxDrawdown: z.number(),
    sharpeRatio: z.number(),
    winRate: z.number(),
  }),
  evaluationDate: z.string(),
  verdict: z.enum(["GO", "NO_GO"]),
  remarks: z.string().optional(),
});

export type StrategyEval = z.infer<typeof StrategyEvalSchema>;
