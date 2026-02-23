import { z } from "zod";
import type { SymbolAnalysis } from "../experiments/analysis/daily_alpha.ts";
import { average } from "../experiments/analysis/daily_alpha.ts";

export const BacktestConfigSchema = z.object({
  from: z.string().regex(/^\d{8}$/),
  to: z.string().regex(/^\d{8}$/),
  feeBps: z.number().min(0),
  slippageBps: z.number().min(0),
});

export type BacktestConfig = z.infer<typeof BacktestConfigSchema>;

export const BacktestResultSchema = z.object({
  from: z.string().regex(/^\d{8}$/),
  to: z.string().regex(/^\d{8}$/),
  tradingDays: z.number().int().positive(),
  feeBps: z.number().min(0),
  slippageBps: z.number().min(0),
  totalCostBps: z.number().min(0),
  grossReturn: z.number(),
  netReturn: z.number(),
  pnlPerUnit: z.number(),
});

export type BacktestResult = z.infer<typeof BacktestResultSchema>;

type RunBacktestArgs = {
  config: BacktestConfig;
  selectedRows: readonly SymbolAnalysis[];
  tradingDays: number;
};

export function runSimpleBacktest(args: RunBacktestArgs): BacktestResult {
  const config = BacktestConfigSchema.parse(args.config);
  const tradingDays = Math.max(1, args.tradingDays);
  const grossReturn = average(
    args.selectedRows.map((s) => s.factors.dailyReturn),
  );
  const totalCostBps = config.feeBps + config.slippageBps;
  const costRate = totalCostBps / 10_000;
  const netReturn = grossReturn - costRate;
  return BacktestResultSchema.parse({
    from: config.from,
    to: config.to,
    tradingDays,
    feeBps: config.feeBps,
    slippageBps: config.slippageBps,
    totalCostBps,
    grossReturn,
    netReturn,
    pnlPerUnit: netReturn,
  });
}
