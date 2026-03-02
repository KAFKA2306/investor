import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import {
  type DailyScenarioLogSchema,
  UnifiedLogSchema,
} from "../../schemas/financial_domain_schemas.ts";
import { fsUtils } from "../../utils/fs_utils.ts";
import { mathUtils } from "../../utils/math_utils.ts";

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

export const mean = mathUtils.mean;

export const std = mathUtils.stdDev;

export const computeMaxDrawdown = mathUtils.computeMaxDrawdown;

export const calculateCorrelation = mathUtils.calculateCorr;

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
  const sharpe = vol < EPS ? 0 : (avg / vol) * Math.sqrt(252);
  const cagr = (1 + cumulative) ** (252 / returns.length) - 1;
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
    informationRatio = volDiff < EPS ? 0 : (muDiff / volDiff) * Math.sqrt(252);
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
    const raw = fsUtils.readJsonFile<any>(path.join(logsDir, file));
    // CanonicalLogEnvelopeSchema が見当たらないので、直接 payload を見るよっ！🛡️
    const envelope = raw;
    if (!envelope || envelope.kind !== "daily_decision") continue;

    const payloadResult = UnifiedLogSchema.safeParse(envelope.payload);
    if (
      !payloadResult.success ||
      payloadResult.data.schema !== "investor.daily-log.v1"
    )
      continue;

    const payload = payloadResult.data;

    const report = payload.data.report as z.infer<
      typeof DailyScenarioLogSchema
    >;
    if (report.scenarioId && report.results?.backtest) {
      const b = report.results.backtest;
      rows.push({
        date: envelope.asOfDate || report.date,
        strategyId: report.scenarioId,
        grossReturn: b.grossReturn,
        netReturn: b.netReturn,
        feeBps: b.feeBps,
        slippageBps: b.slippageBps,
        totalCostBps: b.totalCostBps,
        grossExposure: 1.0,
        metadata: { file, runId: envelope.runId },
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export namespace QuantMetrics {
  export const mean = mathUtils.mean;
  export const calculateCorr = mathUtils.calculateGaussCorr;
  export const calculateTStat = mathUtils.calculateTStat;
  export const calculatePValue = mathUtils.calculatePValue;
  export const calculateRMSE = mathUtils.calculateRMSE;
  export const calculateSMAPE = mathUtils.calculateSMAPE;
  export const calculateDA = mathUtils.calculateDA;
  export const calculateSharpeRatio = mathUtils.calculateSharpeRatio;
  export const calculateAnnualizedReturn = mathUtils.calculateAnnualizedReturn;
}
