import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { core } from "../../core/index.ts";
import { UnifiedLogSchema } from "../../schemas/log.ts";
import {
  calculatePerformanceMetrics,
  PerformanceMetricsSchema,
} from "./performance_metrics.ts";

const ComparisonReportSchema = z.object({
  generatedAt: z.string().datetime(),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/),
    to: z.string().regex(/^\d{8}$/),
  }),
  baseline: z.object({
    name: z.string(),
    metrics: PerformanceMetricsSchema,
  }),
  candidate: z.object({
    name: z.string(),
    metrics: PerformanceMetricsSchema,
  }),
  uplift: z.object({
    cumulativeReturnDelta: z.number(),
    sharpeDelta: z.number(),
    maxDrawdownDelta: z.number(),
    winRateDelta: z.number(),
  }),
});

type DailyPoint = { date: string; basketDailyReturn: number };

const isDailyReport = (report: unknown): report is Record<string, unknown> =>
  typeof report === "object" &&
  report !== null &&
  "scenarioId" in report &&
  "results" in report;

function loadDailySeries(logsDir: string): DailyPoint[] {
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort();
  const points: DailyPoint[] = [];
  for (const file of files) {
    const raw = readFileSync(join(logsDir, file), "utf8");
    let logRaw: unknown = null;
    try {
      logRaw = JSON.parse(raw);
    } catch {
      continue;
    }

    const logObj = logRaw as Record<string, unknown>;
    if (logObj.schema !== "investor.daily-log.v1") continue;

    const result = UnifiedLogSchema.safeParse(logRaw);
    if (!result.success) continue;
    const log = result.data;

    if (!isDailyReport(log.report)) continue;
    const report = log.report as Record<string, unknown>;
    const date = z
      .string()
      .regex(/^\d{8}$/)
      .parse(report.date);
    const results = z.record(z.string(), z.unknown()).parse(report.results);
    const basketDailyReturn = z
      .number()
      .catch(0)
      .parse(results.basketDailyReturn);
    points.push({ date, basketDailyReturn });
  }
  return points;
}

export function runDailyAbComparison(logsBaseDir: string) {
  const logsDir = resolve(logsBaseDir, "daily");
  const points = loadDailySeries(logsDir);
  if (points.length < 1) {
    const emptyMetrics = calculatePerformanceMetrics([]);
    return ComparisonReportSchema.parse({
      generatedAt: new Date().toISOString(),
      dateRange: { from: "19700101", to: "19700101" },
      baseline: { name: "NO_TRADE", metrics: emptyMetrics },
      candidate: { name: "VEGETABLE_STRATEGY", metrics: emptyMetrics },
      uplift: {
        cumulativeReturnDelta: 0,
        sharpeDelta: 0,
        maxDrawdownDelta: 0,
        winRateDelta: 0,
      },
    });
  }
  const returns = points.map((p) => p.basketDailyReturn);
  const baselineReturns = points.map(() => 0);
  const baseline = calculatePerformanceMetrics(baselineReturns);
  const candidate = calculatePerformanceMetrics(returns);
  const report = ComparisonReportSchema.parse({
    generatedAt: new Date().toISOString(),
    dateRange: {
      from: points[0]?.date ?? "19700101",
      to: points[points.length - 1]?.date ?? "19700101",
    },
    baseline: { name: "NO_TRADE", metrics: baseline },
    candidate: { name: "VEGETABLE_STRATEGY", metrics: candidate },
    uplift: {
      cumulativeReturnDelta:
        candidate.cumulativeReturn - baseline.cumulativeReturn,
      sharpeDelta: candidate.sharpe - baseline.sharpe,
      maxDrawdownDelta: candidate.maxDrawdown - baseline.maxDrawdown,
      winRateDelta: candidate.winRate - baseline.winRate,
    },
  });
  return report;
}

if (import.meta.main) {
  const logsBaseDir = core.config.paths.logs;
  const report = runDailyAbComparison(logsBaseDir);
  console.log(JSON.stringify(report, null, 2));
}
