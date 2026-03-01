import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import {
  type DailyScenarioLogSchema,
  UnifiedLogSchema,
} from "../../schemas/financial_domain_schemas.ts";
import { CanonicalLogEnvelopeSchema } from "../../schemas/system_event_schemas.ts";

const EPS = 1e-12;

export const DailyLogSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  strategyReturn: z.number(),
  benchmarkReturn: z.number().optional(),
});

export type DailyLog = z.infer<typeof DailyLogSchema>;

export const EvaluationResultSchema = z.object({
  sampleSize: z.number().int().nonnegative(),
  cumulativeReturn: z.number(),
  cagr: z.number(),
  sharpe: z.number(),
  maxDrawdown: z.number(),
  winRate: z.number(),
  avgReturn: z.number(),
  volatility: z.number(),
  profitFactor: z.number().optional(),
  informationRatio: z.number().optional(),
  informationCoefficient: z.number().optional(),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export const PerformanceMetricsSchema = EvaluationResultSchema;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export const std = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - mu) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
};

export function computeMaxDrawdown(returns: readonly number[]): number {
  let peak = 1,
    equity = 1,
    maxDD = 0;
  for (const r of returns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, (equity - peak) / peak);
  }
  return maxDD;
}

export function calculateCorrelation(
  xs: readonly number[],
  ys: readonly number[],
): number {
  if (xs.length !== ys.length || xs.length === 0) return 0;
  const muX = mean(xs),
    muY = mean(ys),
    stdX = std(xs),
    stdY = std(ys);
  if (stdX < EPS || stdY < EPS) return 0;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) sum += (xs[i]! - muX) * (ys[i]! - muY);
  return sum / (xs.length * stdX * stdY);
}

export function evaluate(
  logs: readonly DailyLog[],
  predictions?: { predicted: number[]; actual: number[] },
): EvaluationResult {
  const returns = logs.map((l) => l.strategyReturn);
  if (returns.length === 0)
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
  const cumulative = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const avg = mean(returns),
    vol = std(returns);
  const sharpe = vol < EPS ? 0 : (avg / vol) * Math.sqrt(365);
  const cagr = (1 + cumulative) ** (365 / returns.length) - 1;
  const winRate = returns.filter((r) => r > 0).length / returns.length;
  const maxDrawdown = computeMaxDrawdown(returns);
  const benchmarks = logs
    .map((l) => l.benchmarkReturn)
    .filter((b): b is number => b !== undefined);
  let informationRatio: number | undefined;
  if (benchmarks.length === returns.length) {
    const diffs = returns.map((r, i) => r - (benchmarks[i] ?? 0));
    const muDiff = mean(diffs),
      volDiff = std(diffs);
    informationRatio = volDiff < EPS ? 0 : (muDiff / volDiff) * Math.sqrt(365);
  }
  const positives = returns.filter((r) => r > 0),
    negatives = returns.filter((r) => r < 0);
  const grossProfit = positives.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(negatives.reduce((a, b) => a + b, 0));
  return EvaluationResultSchema.parse({
    sampleSize: returns.length,
    cumulativeReturn: cumulative,
    cagr,
    sharpe,
    maxDrawdown,
    winRate,
    avgReturn: avg,
    volatility: vol,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    informationRatio,
    informationCoefficient: predictions
      ? calculateCorrelation(predictions.predicted, predictions.actual)
      : undefined,
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

export const PerformanceLedgerRowSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  strategyId: z.string(),
  grossReturn: z.number(),
  netReturn: z.number(),
  benchmarkReturn: z.number().optional(),
  feeBps: z.number().min(0),
  slippageBps: z.number().min(0),
  totalCostBps: z.number().min(0),
  grossExposure: z.number().min(0),
  drawdown: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PerformanceLedgerRow = z.infer<typeof PerformanceLedgerRowSchema>;

export function loadPerformanceLedgerRows(
  logsDir: string,
): PerformanceLedgerRow[] {
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".json"));
  const rows: PerformanceLedgerRow[] = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(logsDir, file), "utf8"));
    const envelope = CanonicalLogEnvelopeSchema.safeParse(raw);
    if (!envelope.success || envelope.data.kind !== "daily_decision") continue;

    const payload = UnifiedLogSchema.safeParse(envelope.data.payload);
    if (!payload.success || payload.data.schema !== "investor.daily-log.v1")
      continue;

    const report = payload.data.report as z.infer<
      typeof DailyScenarioLogSchema
    >;
    if (report.scenarioId && report.results?.backtest) {
      const b = report.results.backtest;
      rows.push({
        date: envelope.data.asOfDate || report.date,
        strategyId: report.scenarioId,
        grossReturn: b.grossReturn,
        netReturn: b.netReturn,
        feeBps: b.feeBps,
        slippageBps: b.slippageBps,
        totalCostBps: b.totalCostBps,
        grossExposure: 1.0,
        metadata: { file, runId: envelope.data.runId },
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export namespace QuantMetrics {
  function normalCdf(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const prob =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  function erfInv(x: number): number {
    const a = 0.147,
      l = Math.log(1 - x * x),
      m = 2 / (Math.PI * a) + l / 2;
    const res = Math.sqrt(Math.sqrt(m * m - l / a) - m);
    return x < 0 ? -res : res;
  }

  function invNormalCdf(p: number): number {
    return Math.sqrt(2) * erfInv(2 * Math.max(0.001, Math.min(0.999, p)) - 1);
  }

  function gaussRank(data: number[]): number[] {
    const sorted = [...data].sort((a, b) => a - b);
    return data.map((v) => invNormalCdf(sorted.indexOf(v) / (data.length - 1)));
  }

  function pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    let sX = 0,
      sY = 0,
      sXY = 0,
      sX2 = 0,
      sY2 = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i]!,
        yi = y[i]!;
      sX += xi;
      sY += yi;
      sXY += xi * yi;
      sX2 += xi * xi;
      sY2 += yi * yi;
    }
    const den = Math.sqrt((n * sX2 - sX * sX) * (n * sY2 - sY * sY));
    return den === 0 ? 0 : (n * sXY - sX * sY) / den;
  }

  export function mean(x: number[]): number {
    return x.reduce((a, b) => a + b, 0) / (x.length || 1);
  }
  export function calculateCorr(p: number[], t: number[]): number {
    return pearson(gaussRank(p), gaussRank(t));
  }
  export function calculateTStat(r: number[]): number {
    const n = r.length;
    if (n < 2) return 0;
    const mu = mean(r),
      sigma = Math.sqrt(r.reduce((acc, v) => acc + (v - mu) ** 2, 0) / n);
    return sigma === 0 ? 0 : mu / (sigma / Math.sqrt(n));
  }
  export function calculatePValue(t: number, n: number): number {
    return n < 2 ? 1.0 : 2 * (1 - normalCdf(Math.abs(t)));
  }
  export function calculateRMSE(a: number[], p: number[]): number {
    const n = Math.min(a.length, p.length);
    if (n === 0) return 0;
    return Math.sqrt(
      a.reduce((acc, val, i) => acc + (val - p[i]!) ** 2, 0) / n,
    );
  }
  export function calculateSMAPE(a: number[], p: number[]): number {
    const n = Math.min(a.length, p.length);
    if (n === 0) return 0;
    const sum = a.reduce((acc, val, i) => {
      const den = (Math.abs(val) + Math.abs(p[i]!)) / 2;
      return acc + (den !== 0 ? Math.abs(p[i]! - val) / den : 0);
    }, 0);
    return (sum / n) * 100;
  }
  export function calculateDA(
    a: number[],
    p: number[],
    prev: number[],
  ): number {
    const n = Math.min(a.length, p.length, prev.length);
    if (n === 0) return 0;
    let correct = 0;
    for (let i = 0; i < n; i++)
      if (Math.sign(a[i]! - prev[i]!) === Math.sign(p[i]! - prev[i]!))
        correct++;
    return (correct / n) * 100;
  }
  export function calculateSharpeRatio(returns: number[], rfr = 0): number {
    if (returns.length < 2) return 0;
    const mu = mean(returns),
      sigma = Math.sqrt(
        returns.reduce((acc, v) => acc + (v - mu) ** 2, 0) / returns.length,
      );
    return sigma === 0 ? 0 : ((mu - rfr) / sigma) * Math.sqrt(252);
  }
  export function calculateAnnualizedReturn(net: number, days: number): number {
    return days <= 0 ? 0 : (1 + net) ** (252 / days) - 1;
  }
}
