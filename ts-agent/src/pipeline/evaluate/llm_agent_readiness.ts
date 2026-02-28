import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { core } from "../../system/core.ts";
import { ReadinessReportSchema, UnifiedLogSchema } from "../../schemas/log.ts";

const YYYMMDD = z.string().regex(/^\d{8}$/);

const DailyPointSchema = z.object({
  date: YYYMMDD,
  basketDailyReturn: z.number(),
  hasBacktestCost: z.boolean(),
  hasExecution: z.boolean(),
  hasModelRefs: z.boolean(),
  action: z.string(),
});

export type DailyPoint = z.infer<typeof DailyPointSchema>;

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function toScore(normalized: number, maxPoints: number): number {
  return Math.round(clamp01(normalized) * maxPoints);
}

function loadDailyPoints(logsDir: string): DailyPoint[] {
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}(?:_[\w-]+)?\.json$/.test(f))
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

    // Only process daily-log schema
    const logObj = logRaw as Record<string, unknown>;
    if (logObj.schema !== "investor.daily-log.v1") continue;

    const result = UnifiedLogSchema.safeParse(logRaw);
    if (!result.success) {
      console.warn(`[Readiness] Skipping ${file} due to schema mismatch.`);
      continue;
    }
    const log = result.data;
    if (typeof log.report !== "object" || log.report === null) continue;

    // Type guard for daily scenario report
    if (!("results" in log.report)) continue;
    const report = log.report;

    const results = report.results;
    const backtest = (results.backtest || {}) as Record<string, unknown>;
    const models = (log.models || []) as Array<Record<string, unknown>>;
    const hasModelRefs = models.length > 0;
    const hasBacktestCost =
      typeof backtest.totalCostBps === "number" &&
      Number.isFinite(backtest.totalCostBps);
    const hasExecution =
      typeof report.execution === "object" && report.execution !== null;
    const date = YYYMMDD.parse(report.date);
    const basketDailyReturn = results.basketDailyReturn || 0;
    const action = report.decision?.action || "UNKNOWN";

    points.push(
      DailyPointSchema.parse({
        date,
        basketDailyReturn,
        hasBacktestCost,
        hasExecution,
        hasModelRefs,
        action,
      }),
    );
  }
  return points;
}

export function runLlmAgentReadiness(logsBaseDir: string) {
  const logsDir = resolve(logsBaseDir, "daily");
  const points = loadDailyPoints(logsDir);
  if (points.length === 0) {
    throw new Error(`No daily log files found in ${logsDir}`);
  }

  return calculateReadinessFromPoints(points);
}

export function calculateReadinessFromPoints(
  points: readonly DailyPoint[],
): z.infer<typeof ReadinessReportSchema> {
  const sampleSize = points.length;
  const costCoverage =
    points.filter((p) => p.hasBacktestCost).length / Math.max(1, sampleSize);
  const modelCoverage =
    points.filter((p) => p.hasModelRefs).length / Math.max(1, sampleSize);
  const reproducibilityCoverage =
    points.filter((p) => p.date && Number.isFinite(p.basketDailyReturn))
      .length / Math.max(1, sampleSize);
  const executionCoverage =
    points.filter((p) => p.hasExecution).length / Math.max(1, sampleSize);
  const noTradeRatio =
    points.filter((p) => p.action === "NO_TRADE").length /
    Math.max(1, sampleSize);
  const returnStd = Math.sqrt(
    points.map((p) => p.basketDailyReturn).reduce((acc, x) => acc + x * x, 0) /
      Math.max(1, sampleSize),
  );

  const dataHorizon = toScore(sampleSize / 756, 25);
  const costAwareness = toScore(costCoverage, 20);
  const outOfSampleDiscipline = toScore(
    clamp01(noTradeRatio + Math.min(returnStd / 0.02, 1) * 0.4),
    20,
  );
  const modelTraceability = toScore(modelCoverage, 15);
  const reproducibility = toScore(reproducibilityCoverage, 10);
  const executionObservability = toScore(executionCoverage, 10);

  const total =
    dataHorizon +
    costAwareness +
    outOfSampleDiscipline +
    modelTraceability +
    reproducibility +
    executionObservability;

  const productionReadyMin = 75;
  const cautionMin = 50;
  const verdict =
    total >= productionReadyMin
      ? "READY"
      : total >= cautionMin
        ? "CAUTION"
        : "NOT_READY";

  const recommendations: string[] = [];
  if (sampleSize < 252)
    recommendations.push(
      "Sample window is short. Expand daily logs to at least 252 trading days; target 756 days.",
    );
  if (costCoverage < 1)
    recommendations.push(
      "Attach fee/slippage fields to all daily logs (`results.backtest.totalCostBps`).",
    );
  if (executionCoverage < 1)
    recommendations.push(
      "Persist `report.execution` every day, even when skipped, for audit completeness.",
    );
  if (modelCoverage < 1)
    recommendations.push(
      "Ensure each run stores model references (`github`/`arxiv`/`context7LibraryId`).",
    );

  if (recommendations.length === 0) {
    recommendations.push("Current setup satisfies baseline readiness checks.");
  }

  return ReadinessReportSchema.parse({
    generatedAt: new Date().toISOString(),
    dateRange: {
      from: points[0]?.date ?? "19700101",
      to: points[points.length - 1]?.date ?? "19700101",
    },
    sampleSize,
    score: {
      dataHorizon,
      costAwareness,
      outOfSampleDiscipline,
      modelTraceability,
      reproducibility,
      executionObservability,
      total,
    },
    thresholds: {
      productionReadyMin,
      cautionMin,
    },
    verdict,
    recommendations,
  });
}

if (import.meta.main) {
  const logsBaseDir = core.config.paths.logs;
  const report = runLlmAgentReadiness(logsBaseDir);
  console.log(JSON.stringify(report, null, 2));
}
