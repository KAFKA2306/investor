import { z } from "zod";

export const PerformanceMetricsSchema = z.object({
  sampleSize: z.number().int().nonnegative(),
  totalReturn: z.number(),
  annualizedReturn: z.number(),
  volatility: z.number(),
  sharpe: z.number(),
  maxDrawdown: z.number(),
  hitRate: z.number().min(0).max(1),
  profitFactor: z.number(),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

const average = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

const stddev = (xs: readonly number[]): number => {
  const mu = average(xs);
  const variance = average(xs.map((x) => (x - mu) ** 2));
  return Math.sqrt(variance);
};

const equityCurve = (returns: readonly number[]): number[] => {
  const curve: number[] = [];
  let equity = 1;
  for (const r of returns) {
    equity *= 1 + r;
    curve.push(equity);
  }
  return curve;
};

const calculateMaxDrawdown = (returns: readonly number[]): number => {
  const curve = equityCurve(returns);
  let peak = 1;
  let maxDd = 0;
  for (const eq of curve) {
    peak = Math.max(peak, eq);
    const dd = (eq - peak) / Math.max(peak, 1e-12);
    maxDd = Math.min(maxDd, dd);
  }
  return maxDd;
};

export function calculatePerformanceMetrics(
  returns: readonly number[],
  periodsPerYear = 252,
): PerformanceMetrics {
  const sampleSize = returns.length;
  if (sampleSize === 0) {
    return PerformanceMetricsSchema.parse({
      sampleSize: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpe: 0,
      maxDrawdown: 0,
      hitRate: 0,
      profitFactor: 0,
    });
  }

  const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const avg = average(returns);
  const vol = stddev(returns);
  const annualizedReturn = (1 + avg) ** periodsPerYear - 1;
  const annualizedVol = vol * Math.sqrt(periodsPerYear);
  const sharpe = annualizedVol > 0 ? annualizedReturn / annualizedVol : 0;
  const maxDrawdown = calculateMaxDrawdown(returns);
  const positives = returns.filter((r) => r > 0);
  const negatives = returns.filter((r) => r < 0);
  const hitRate = positives.length / sampleSize;
  const grossProfit = positives.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(negatives.reduce((a, b) => a + b, 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  return PerformanceMetricsSchema.parse({
    sampleSize,
    totalReturn,
    annualizedReturn,
    volatility: annualizedVol,
    sharpe,
    maxDrawdown,
    hitRate,
    profitFactor,
  });
}
