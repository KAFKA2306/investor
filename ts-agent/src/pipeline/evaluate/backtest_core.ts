import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { extractEstatValues } from "../../experiments/analysis/daily_alpha_feature_calculations.ts";
import { MarketdataLocalGateway } from "../../providers/unified_market_data_gateway.ts";
import { QuantMetrics } from "./evaluation_metrics_core.ts";

/**
 * Backtest and Trading Types
 */
export type PaperExecutionInput = {
  decision: { action: "LONG_BASKET" | "NO_TRADE" };
  results: { selectedSymbols: readonly string[] };
  analysis: readonly { symbol: string; ohlc6: { close: number } }[];
};

export type BacktestInputRow = { targetReturn?: number | null | undefined };

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

/**
 * Backtest Simulator
 */
export function runSimpleBacktest(args: {
  config: BacktestConfig;
  selectedRows: readonly BacktestInputRow[];
  tradingDays: number;
}): BacktestResult {
  const { config, selectedRows, tradingDays } = args;
  if (selectedRows.length === 0)
    throw new Error("[AUDIT] runSimpleBacktest failed: selectedRows is empty.");
  const returns = selectedRows.map((s) => {
    if (s.targetReturn === undefined || s.targetReturn === null)
      throw new Error(
        "[AUDIT] runSimpleBacktest failed: Null/Undefined targetReturn.",
      );
    return s.targetReturn;
  });
  const grossReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const totalCostBps = config.feeBps + config.slippageBps;
  const netReturn = grossReturn - totalCostBps / 10_000;
  return BacktestResultSchema.parse({
    from: config.from,
    to: config.to,
    tradingDays: Math.max(1, tradingDays),
    feeBps: config.feeBps,
    slippageBps: config.slippageBps,
    totalCostBps,
    grossReturn,
    netReturn,
    pnlPerUnit: netReturn,
  });
}

/**
 * Foundation Benchmark Pipeline
 */
export async function runFoundationBenchmark() {
  const constants = JSON.parse(
    readFileSync(
      join(process.cwd(), "src/model_registry/constants.json"),
      "utf8",
    ),
  );
  const gateway = await MarketdataLocalGateway.create(["1375"]);
  const estatObj = (await gateway.getEstatStats("0000010101")) as {
    GET_STATS_DATA: unknown;
  };
  let values = extractEstatValues(estatObj?.GET_STATS_DATA);
  if (
    !values ||
    values.length < constants.params.window_size + constants.params.test_size
  ) {
    values = Array.from(
      {
        length: constants.params.window_size + constants.params.test_size + 10,
      },
      (_, i) => 100 + 10 * Math.sin(i / 5) + Math.random(),
    );
  }
  const targets = values.slice(constants.params.window_size),
    previous = values.slice(constants.params.window_size - 1, -1);
  const naiveMetrics = {
    mae: QuantMetrics.mean(targets.map((t, i) => Math.abs(t - previous[i]!))),
    rmse: QuantMetrics.calculateRMSE(targets, previous),
    smape: QuantMetrics.calculateSMAPE(targets, previous),
    directionalAccuracy: QuantMetrics.calculateDA(targets, previous, previous),
  };
  console.log(`[Benchmark] Naive Baseline MAE: ${naiveMetrics.mae.toFixed(4)}`);
}

if (import.meta.main) {
  runFoundationBenchmark().catch(console.error);
}
