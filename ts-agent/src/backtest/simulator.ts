import { z } from "zod";
import type { BacktestInputRow } from "../contracts/trading.ts";

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
  history: z.array(z.number()).optional(),
});

export type BacktestResult = z.infer<typeof BacktestResultSchema>;

type RunBacktestArgs = {
  config: BacktestConfig;
  selectedRows: readonly BacktestInputRow[];
  tradingDays: number;
};

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function runSimpleBacktest(args: RunBacktestArgs): BacktestResult {
  const config = BacktestConfigSchema.parse(args.config);
  const tradingDays = Math.max(1, args.tradingDays);
  if (args.selectedRows.length === 0) {
    throw new Error(
      "[AUDIT] runSimpleBacktest failed: selectedRows is empty. No evidence to process.",
    );
  }
  // Audit Fix: Use realized targetReturn (T-day), not the signal feature (T-1)
  const returns = args.selectedRows.map((s) => {
    if (s.targetReturn === undefined || s.targetReturn === null) {
      throw new Error(
        "[AUDIT] runSimpleBacktest failed: Null/Undefined targetReturn detected in selectedRows.",
      );
    }
    return s.targetReturn;
  });

  const grossReturn = average(returns);
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
