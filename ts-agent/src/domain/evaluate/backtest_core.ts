import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { extractEstatValues } from "../../experiments/analysis/daily_alpha_feature_calculations.ts";
import { MarketdataLocalGateway } from "../../io/market/unified_market_data_gateway.ts";
import {
  calculatePerformanceMetrics,
  QuantMetrics,
} from "../../pipeline/evaluate/evaluation_metrics_core.ts";
import { logIO, logMetric } from "../../system/telemetry_logger.ts";

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

export async function runFoundationBenchmark() {
  const constants = JSON.parse(
    readFileSync(
      join(process.cwd(), "src/model_registry/constants.json"),
      "utf8",
    ),
  );
  const gateway = await MarketdataLocalGateway.create(["1375"]);
  logIO({
    stage: "benchmark.foundation",
    direction: "IN",
    name: "benchmark_config",
    values: {
      symbol: "1375",
      window_size: constants.params.window_size,
      test_size: constants.params.test_size,
    },
  });
  const localHistory = await gateway.getHistory(
    "1375",
    constants.params.window_size + constants.params.test_size + 10,
  );
  let values = localHistory.map((v) => Number(v));
  if (
    !values ||
    values.length < constants.params.window_size + constants.params.test_size
  ) {
    const estatObj = (await gateway.getEstatStats("0000010101")) as {
      GET_STATS_DATA: unknown;
    };
    values = extractEstatValues(estatObj?.GET_STATS_DATA);
  }
  logIO({
    stage: "benchmark.foundation",
    direction: "OUT",
    name: "data.describe",
    values: {
      observations: values.length,
      train_window: constants.params.window_size,
      test_window: constants.params.test_size,
      source: values.length === localHistory.length ? "local" : "estat",
    },
  });
  const targets = values.slice(constants.params.window_size),
    previous = values.slice(constants.params.window_size - 1, -1);
  const naiveMetrics = {
    mae: QuantMetrics.mean(targets.map((t, i) => Math.abs(t - previous[i]!))),
    rmse: QuantMetrics.calculateRMSE(targets, previous),
    smape: QuantMetrics.calculateSMAPE(targets, previous),
    directionalAccuracy: QuantMetrics.calculateDA(targets, previous, previous),
  };
  console.log(`[Benchmark] Naive Baseline MAE: ${naiveMetrics.mae.toFixed(4)}`);
  const returns = targets.map((t, i) => {
    const base = previous[i]!;
    return base === 0 ? 0 : (t - base) / base;
  });
  const perf = calculatePerformanceMetrics(returns);
  const pnlPerUnit = perf.cumulativeReturn;
  logMetric({
    stage: "benchmark.foundation",
    name: "forecast_metrics",
    values: {
      mae: Number(naiveMetrics.mae.toFixed(6)),
      rmse: Number(naiveMetrics.rmse.toFixed(6)),
      smape: Number(naiveMetrics.smape.toFixed(6)),
      directional_accuracy: Number(naiveMetrics.directionalAccuracy.toFixed(6)),
    },
  });
  logMetric({
    stage: "benchmark.foundation",
    name: "finance_metrics",
    values: {
      cumulative_return: Number(perf.cumulativeReturn.toFixed(6)),
      sharpe: Number(perf.sharpe.toFixed(6)),
      max_drawdown: Number(perf.maxDrawdown.toFixed(6)),
      win_rate: Number(perf.winRate.toFixed(6)),
      pnl_per_unit: Number(pnlPerUnit.toFixed(6)),
    },
  });
  console.log(
    `[Finance] cumulative_return=${perf.cumulativeReturn.toFixed(6)}`,
  );
  console.log(`[Finance] sharpe=${perf.sharpe.toFixed(4)}`);
  console.log(`[Finance] max_drawdown=${perf.maxDrawdown.toFixed(6)}`);
  console.log(`[Finance] win_rate=${perf.winRate.toFixed(4)}`);
  console.log(`[Finance] pnl_per_unit=${pnlPerUnit.toFixed(6)}`);
}

if (import.meta.main) {
  runFoundationBenchmark().catch(console.error);
}
