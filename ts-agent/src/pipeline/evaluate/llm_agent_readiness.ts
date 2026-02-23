import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { UnifiedLogSchema } from "../../schemas/log.ts";

const YYYMMDD = z.string().regex(/^\d{8}$/);

const DailyPointSchema = z.object({
  date: YYYMMDD,
  basketDailyReturn: z.number(),
  hasBacktestCost: z.boolean(),
  hasExecution: z.boolean(),
  hasModelRefs: z.boolean(),
  action: z.string(),
});

type DailyPoint = z.infer<typeof DailyPointSchema>;

const ReadinessReportSchema = z.object({
  generatedAt: z.string().datetime(),
  dateRange: z.object({
    from: YYYMMDD,
    to: YYYMMDD,
  }),
  sampleSize: z.number().int().nonnegative(),
  score: z.object({
    dataHorizon: z.number(),
    costAwareness: z.number(),
    outOfSampleDiscipline: z.number(),
    modelTraceability: z.number(),
    reproducibility: z.number(),
    executionObservability: z.number(),
    total: z.number(),
  }),
  thresholds: z.object({
    productionReadyMin: z.number(),
    cautionMin: z.number(),
  }),
  verdict: z.enum(["NOT_READY", "CAUTION", "READY"]),
  recommendations: z.array(z.string()),
});

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
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort();
  const points: DailyPoint[] = [];
  for (const file of files) {
    const raw = readFileSync(join(logsDir, file), "utf8");
    const log = UnifiedLogSchema.parse(JSON.parse(raw) as unknown);
    if (typeof log.report !== "object" || log.report === null) continue;
    const report = z.record(z.string(), z.unknown()).parse(log.report);
    const results = z
      .record(z.string(), z.unknown())
      .catch({})
      .parse(report.results);
    const backtest = z
      .record(z.string(), z.unknown())
      .catch({})
      .parse(results.backtest);
    const models = z.array(z.unknown()).catch([]).parse(log.models);
    const hasModelRefs = models.length > 0;
    const hasBacktestCost =
      typeof backtest.totalCostBps === "number" &&
      Number.isFinite(backtest.totalCostBps);
    const hasExecution =
      typeof report.execution === "object" && report.execution !== null;
    const date = YYYMMDD.parse(report.date);
    const basketDailyReturn = z
      .number()
      .catch(0)
      .parse(results.basketDailyReturn);
    const action = z
      .string()
      .catch("UNKNOWN")
      .parse(
        z.record(z.string(), z.unknown()).catch({}).parse(report.decision)
          .action,
      );
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
  const logsBaseDir = resolve(process.cwd(), "../logs");
  const report = runLlmAgentReadiness(logsBaseDir);
  console.log(JSON.stringify(report, null, 2));
}
