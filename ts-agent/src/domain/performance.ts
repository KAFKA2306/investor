import {
  type DailyLog,
  type EvaluationResult,
  EvaluationResultSchema,
} from "../schemas/performance_schema.ts";

const EPS = 1e-12;

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

export function evaluate(logs: readonly DailyLog[]): EvaluationResult {
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
  });
}
