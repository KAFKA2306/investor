import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { UnifiedLogSchema } from "../../schemas/log.ts";
import {
  calculatePerformanceMetrics,
  PerformanceMetricsSchema,
} from "../evaluate/performance_metrics.ts";
import {
  type FactorExpression,
  FactorExpressionSchema,
} from "./generate_candidates.ts";

const FeatureRowSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  features: z.record(z.string(), z.number()),
  basketDailyReturn: z.number(),
});

const EvaluatedFactorSchema = z.object({
  candidate: FactorExpressionSchema,
  metrics: PerformanceMetricsSchema,
  pValue: z.number().min(0).max(1),
  meanSignalAbs: z.number().nonnegative(),
  accepted: z.boolean(),
});

export type FeatureRow = z.infer<typeof FeatureRowSchema>;
export type EvaluatedFactor = z.infer<typeof EvaluatedFactorSchema>;

const isDailyReport = (report: unknown): report is Record<string, unknown> =>
  typeof report === "object" && report !== null && "scenarioId" in report;

const average = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function stddev(xs: readonly number[]): number {
  const mu = average(xs);
  const variance = average(xs.map((x) => (x - mu) ** 2));
  return Math.sqrt(variance);
}

function twoSidedPValueFromT(tStat: number): number {
  const abs = Math.abs(tStat);
  if (abs >= 3) return 0.01;
  if (abs >= 2) return 0.05;
  if (abs >= 1.64) return 0.1;
  return 0.5;
}

function normalize(x: number, scale: number): number {
  return x / Math.max(scale, 1e-9);
}

function buildFeaturesFromDailyLog(raw: unknown): FeatureRow | null {
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as Record<string, unknown>).schema !== "investor.daily-log.v1"
  ) {
    return null;
  }

  const result = UnifiedLogSchema.safeParse(raw);
  if (!result.success) return null;
  const log = result.data;

  if (!isDailyReport(log.report)) return null;
  const report = log.report as Record<string, unknown>;

  const date = z
    .string()
    .regex(/^\d{8}$/)
    .parse(report.date);
  const market = z.record(z.string(), z.unknown()).parse(report.market);
  const analysis = z
    .array(z.record(z.string(), z.unknown()))
    .parse(report.analysis);
  const results = z.record(z.string(), z.unknown()).parse(report.results);

  const rows = analysis.map((r) => {
    const factors = z.record(z.string(), z.number()).parse(r.factors);
    const alphaScore = z.number().parse(r.alphaScore);
    const finance = z.record(z.string(), z.number()).parse(r.finance);
    return { factors, alphaScore, finance };
  });

  if (rows.length === 0) return null;

  const avg = (values: readonly number[]) => average(values);
  const avgAlphaScore = avg(rows.map((r) => r.alphaScore));
  const avgDailyReturn = avg(rows.map((r) => r.factors.dailyReturn ?? 0));
  const avgIntradayRange = avg(rows.map((r) => r.factors.intradayRange ?? 0));
  const avgCloseStrength = avg(rows.map((r) => r.factors.closeStrength ?? 0));
  const avgLiquidity = avg(rows.map((r) => r.factors.liquidityPerShare ?? 0));
  const avgProfitMargin = avg(rows.map((r) => r.finance.profitMargin ?? 0));
  const basketDailyReturn = z.number().parse(results.basketDailyReturn);
  const vegetablePriceMomentum = z
    .number()
    .parse(market.vegetablePriceMomentum);

  return FeatureRowSchema.parse({
    date,
    basketDailyReturn,
    features: {
      vegetablePriceMomentum,
      avgAlphaScore,
      avgDailyReturn,
      avgIntradayRange,
      avgCloseStrength,
      avgLiquidity: normalize(avgLiquidity, 1000),
      avgProfitMargin,
    },
  });
}

export function loadFeatureRows(logsBaseDir: string): FeatureRow[] {
  const logsDir = resolve(logsBaseDir, "daily");
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort();

  const rows: FeatureRow[] = [];
  for (const file of files) {
    const raw = JSON.parse(
      readFileSync(join(logsDir, file), "utf8"),
    ) as unknown;
    const parsed = buildFeaturesFromDailyLog(raw);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function scoreFactor(
  features: Readonly<Record<string, number>>,
  factor: FactorExpression,
): number {
  const weighted = Object.entries(factor.weights).reduce(
    (acc, [name, w]) => acc + (features[name] ?? 0) * w,
    factor.bias,
  );
  return weighted;
}

function simulateReturns(
  rows: readonly FeatureRow[],
  factor: FactorExpression,
): number[] {
  const simulated: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];
    if (!current || !next) continue;

    const signal = scoreFactor(current.features, factor);
    const position = Math.abs(signal) < 0.05 ? 0 : Math.sign(signal);
    simulated.push(position * next.basketDailyReturn);
  }
  return simulated;
}

function evaluateSingleFactor(
  rows: readonly FeatureRow[],
  factor: FactorExpression,
): EvaluatedFactor {
  const strategyReturns = simulateReturns(rows, factor);
  const metrics = calculatePerformanceMetrics(strategyReturns);
  const mean = average(strategyReturns);
  const vol = stddev(strategyReturns);
  const tStat =
    vol > 0 ? mean / (vol / Math.sqrt(Math.max(1, strategyReturns.length))) : 0;
  const pValue = twoSidedPValueFromT(tStat);

  const baseline = calculatePerformanceMetrics(
    Array.from({ length: strategyReturns.length }, () => 0),
  );
  const accepted =
    metrics.sharpe - baseline.sharpe >= 0.2 &&
    metrics.maxDrawdown <= baseline.maxDrawdown * 0.9 &&
    metrics.cumulativeReturn > 0 &&
    pValue <= 0.05;

  const signals = rows
    .slice(0, -1)
    .map((row) => Math.abs(scoreFactor(row.features, factor)));

  return EvaluatedFactorSchema.parse({
    candidate: factor,
    metrics,
    pValue,
    meanSignalAbs: average(signals),
    accepted,
  });
}

export function evaluateFactorCandidates(
  rows: readonly FeatureRow[],
  factors: readonly FactorExpression[],
): EvaluatedFactor[] {
  return factors
    .map((factor) => evaluateSingleFactor(rows, factor))
    .sort((a, b) => {
      if (b.accepted !== a.accepted)
        return Number(b.accepted) - Number(a.accepted);
      if (b.metrics.sharpe !== a.metrics.sharpe)
        return b.metrics.sharpe - a.metrics.sharpe;
      return b.metrics.cumulativeReturn - a.metrics.cumulativeReturn;
    });
}
