import type { z } from "zod";
import { z as zod } from "zod";
import type { PerformanceLedgerRow } from "./performance_ledger_loader.ts";

const EPS = 1e-12;

export const DailyLogSchema = zod.object({
  date: zod.string().regex(/^\d{8}$/),
  strategyReturn: zod.number(),
  benchmarkReturn: zod.number().optional(),
});

export type DailyLog = zod.infer<typeof DailyLogSchema>;

export const EvaluationResultSchema = zod.object({
  sampleSize: zod.number().int().nonnegative(),
  cumulativeReturn: zod.number(),
  cagr: zod.number(),
  sharpe: zod.number(),
  maxDrawdown: zod.number(),
  winRate: zod.number(),
  avgReturn: zod.number(),
  volatility: zod.number(),
  profitFactor: zod.number().optional(),
  informationRatio: zod.number().optional(),
  informationCoefficient: zod.number().optional(),
});

export const ExecutionAuditSchema = zod.object({
  theoreticalCostBps: zod.number(),
  realizedCostBps: zod.number().optional(),
  slippageImpact: zod.number(),
  executionEfficiency: zod.number(),
});

export type EvaluationResult = zod.infer<typeof EvaluationResultSchema>;
export const PerformanceMetricsSchema = EvaluationResultSchema;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

export const std = (xs: readonly number[]): number => {
  const mu = mean(xs);
  const variance = mean(xs.map((x) => (x - mu) ** 2));
  return Math.sqrt(variance);
};

export function computeMaxDrawdown(returns: readonly number[]): number {
  let peak = 1;
  let equity = 1;
  let maxDD = 0;

  for (const r of returns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    const dd = (equity - peak) / peak;
    maxDD = Math.min(maxDD, dd);
  }

  return maxDD;
}

export function calculateCorrelation(
  xs: readonly number[],
  ys: readonly number[],
): number {
  if (xs.length !== ys.length || xs.length === 0) return 0;
  const muX = mean(xs);
  const muY = mean(ys);
  const stdX = std(xs);
  const stdY = std(ys);
  if (stdX < EPS || stdY < EPS) return 0;

  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += (xs[i]! - muX) * (ys[i]! - muY);
  }
  return sum / (xs.length * stdX * stdY);
}

export function evaluate(
  logs: readonly DailyLog[],
  predictions?: { predicted: number[]; actual: number[] },
): EvaluationResult {
  const returns = logs.map((l) => l.strategyReturn);
  if (returns.length === 0) {
    return EvaluationResultSchema.parse({
      sampleSize: 0,
      cumulativeReturn: 0,
      cagr: 0,
      sharpe: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgReturn: 0,
      volatility: 0,
    });
  }

  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const avg = mean(returns);
  const vol = std(returns);

  const sharpe = vol < EPS ? 0 : (avg / vol) * Math.sqrt(365);
  const cagr = (1 + cumulative) ** (365 / returns.length) - 1;
  const winRate = returns.filter((r) => r > 0).length / returns.length;
  const maxDrawdown = computeMaxDrawdown(returns);

  let informationRatio: number | undefined;
  const benchmarks = logs
    .map((l) => l.benchmarkReturn)
    .filter((b): b is number => b !== undefined);

  if (benchmarks.length === returns.length) {
    const diffs = returns.map((r, i) => r - (benchmarks[i] ?? 0));
    const muDiff = mean(diffs);
    const volDiff = std(diffs);
    informationRatio = volDiff < EPS ? 0 : (muDiff / volDiff) * Math.sqrt(365);
  }

  const informationCoefficient = predictions
    ? calculateCorrelation(predictions.predicted, predictions.actual)
    : undefined;

  const positives = returns.filter((r) => r > 0);
  const negatives = returns.filter((r) => r < 0);
  const grossProfit = positives.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(negatives.reduce((a, b) => a + b, 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  return EvaluationResultSchema.parse({
    sampleSize: returns.length,
    cumulativeReturn: cumulative,
    cagr,
    sharpe,
    maxDrawdown,
    winRate,
    avgReturn: avg,
    volatility: vol,
    profitFactor,
    informationRatio,
    informationCoefficient,
  });
}

export function calculatePerformanceMetrics(
  returns: readonly number[],
  benchmarks?: readonly number[],
): PerformanceMetrics {
  const logs: DailyLog[] = returns.map((r, i) => ({
    date: "20000101",
    strategyReturn: r,
    benchmarkReturn: benchmarks?.[i],
  }));

  return evaluate(logs);
}

export function calculatePerformanceMetricsFromLedger(
  rows: readonly PerformanceLedgerRow[],
): PerformanceMetrics {
  const logs: DailyLog[] = rows.map((row) => ({
    date: row.date,
    strategyReturn: row.netReturn,
    benchmarkReturn: row.benchmarkReturn,
  }));
  return evaluate(logs);
}
