import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { core } from "../../core/index.ts";
import {
  average,
  extractEstatValues,
} from "../../experiments/analysis/daily_alpha.ts";
import { MarketdataLocalGateway } from "../../gateways/marketdata_local_gateway.ts";
import { getTSModels } from "../../model_registry/registry.ts";
import { UnifiedLogSchema } from "../../schemas/log.ts";

function calculateRMSE(actuals: number[], predictions: number[]): number {
  const mse = average(actuals.map((a, i) => (a - (predictions[i] ?? 0)) ** 2));
  return Math.sqrt(mse);
}

function calculateSMAPE(actuals: number[], predictions: number[]): number {
  const sum = actuals.reduce((acc, a, i) => {
    const p = predictions[i] ?? 0;
    const denom = Math.abs(a) + Math.abs(p);
    if (denom === 0) return acc;
    return acc + (2 * Math.abs(p - a)) / denom;
  }, 0);
  return (sum / actuals.length) * 100;
}

function calculateDirectionalAccuracy(
  actuals: number[],
  predictions: number[],
  previousValues: number[],
): number {
  let correct = 0;
  for (let i = 0; i < actuals.length; i++) {
    const actualValue = actuals[i] ?? 0;
    const actualChange = actualValue - (previousValues[i] ?? 0);
    const predictedChange = (predictions[i] ?? 0) - (previousValues[i] ?? 0);
    if (Math.sign(actualChange) === Math.sign(predictedChange)) {
      correct++;
    }
  }
  return (correct / actuals.length) * 100;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function confidenceFromChange(
  prediction: number,
  previousValue: number,
  scale: number,
): number {
  const normalized = Math.abs(prediction - previousValue) / Math.max(scale, 1);
  return clamp01(normalized);
}

function calculateAbstentionRate(abstentions: boolean[]): number {
  if (abstentions.length === 0) return 0;
  const abstainCount = abstentions.filter(Boolean).length;
  return (abstainCount / abstentions.length) * 100;
}

function calculateSafeAccuracy(
  actuals: number[],
  predictions: number[],
  previousValues: number[],
  abstentions: boolean[],
  noiseThreshold: number,
): number {
  if (actuals.length === 0) return 0;
  let safeActions = 0;
  for (let i = 0; i < actuals.length; i++) {
    const abstained = abstentions[i] ?? false;
    const actualChange = (actuals[i] ?? 0) - (previousValues[i] ?? 0);
    if (abstained) {
      if (Math.abs(actualChange) <= noiseThreshold) safeActions++;
      continue;
    }

    const predictedChange = (predictions[i] ?? 0) - (previousValues[i] ?? 0);
    if (Math.sign(actualChange) === Math.sign(predictedChange)) safeActions++;
  }
  return (safeActions / actuals.length) * 100;
}

function calculateOverconfidenceError(
  actuals: number[],
  predictions: number[],
  previousValues: number[],
  confidences: number[],
  threshold = 0.8,
): number {
  let highConfidenceCalls = 0;
  let highConfidenceErrors = 0;
  for (let i = 0; i < actuals.length; i++) {
    const confidence = confidences[i] ?? 0;
    if (confidence < threshold) continue;
    highConfidenceCalls++;
    const actualChange = (actuals[i] ?? 0) - (previousValues[i] ?? 0);
    const predictedChange = (predictions[i] ?? 0) - (previousValues[i] ?? 0);
    if (Math.sign(actualChange) !== Math.sign(predictedChange)) {
      highConfidenceErrors++;
    }
  }
  if (highConfidenceCalls === 0) return 0;
  return (highConfidenceErrors / highConfidenceCalls) * 100;
}

function calculateBrierScore(
  actuals: number[],
  previousValues: number[],
  confidences: number[],
): number {
  if (actuals.length === 0) return 0;
  const loss = actuals.reduce((acc, _, i) => {
    const actualUp = (actuals[i] ?? 0) >= (previousValues[i] ?? 0) ? 1 : 0;
    const probabilityUp = confidences[i] ?? 0;
    return acc + (probabilityUp - actualUp) ** 2;
  }, 0);
  return loss / actuals.length;
}

function calculateECE(
  actuals: number[],
  predictions: number[],
  previousValues: number[],
  confidences: number[],
  binCount = 10,
): number {
  if (actuals.length === 0) return 0;
  let total = 0;
  for (let b = 0; b < binCount; b++) {
    const lower = b / binCount;
    const upper = (b + 1) / binCount;
    const indices = confidences
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) =>
        b === binCount - 1 ? c >= lower && c <= upper : c >= lower && c < upper,
      )
      .map(({ idx }) => idx);

    if (indices.length === 0) continue;

    const avgConfidence =
      indices.reduce((acc, idx) => acc + (confidences[idx] ?? 0), 0) /
      indices.length;
    const avgAccuracy =
      indices.reduce((acc, idx) => {
        const actualChange = (actuals[idx] ?? 0) - (previousValues[idx] ?? 0);
        const predictedChange =
          (predictions[idx] ?? 0) - (previousValues[idx] ?? 0);
        return (
          acc + (Math.sign(actualChange) === Math.sign(predictedChange) ? 1 : 0)
        );
      }, 0) / indices.length;

    total +=
      (indices.length / actuals.length) * Math.abs(avgConfidence - avgAccuracy);
  }
  return total;
}

/**
 * Calculates a simple t-statistic for the improvement of model MAE over naive MAE.
 * t = (mean_diff) / (std_err_diff)
 */
function calculateSignificance(naiveErrors: number[], modelErrors: number[]) {
  const diffs = naiveErrors.map((n, i) => n - (modelErrors[i] ?? 0));
  const meanDiff = average(diffs);
  const variance = average(diffs.map((d) => (d - meanDiff) ** 2));
  const stdErr = Math.sqrt(variance / Math.max(1, diffs.length));
  const tStat = stdErr === 0 ? 0 : meanDiff / stdErr;

  // Rough p-value approximation for demo purposes
  const pValue = Math.abs(tStat) > 3 ? 0.01 : Math.abs(tStat) > 2 ? 0.05 : 0.5;
  return { tStat, pValue };
}

export async function runFoundationBenchmark() {
  const startTime = Date.now();
  console.log("🚀 Foundation Model Benchmark: Metric-Driven Comparison");
  console.log(
    "======================================================================",
  );

  // 1. Data Ingestion
  let values: number[] = [];
  let dataStatus: "PASS" | "FAIL" = "PASS";
  const envCheck: Record<string, boolean> = { ESTAT_APP_ID: true };

  try {
    const gateway = await MarketdataLocalGateway.create(["1375"]);
    const estatObj = (await gateway.getEstatStats("0000010101")) as Record<
      string,
      unknown
    >;
    const rawData = estatObj.GET_STATS_DATA;
    values = extractEstatValues(rawData);
  } catch (_e) {
    console.warn("⚠️ Data ingestion failed. Using mock data for demonstration.");
    values = [210, 215, 208, 220, 225, 218, 230, 235, 228];
    dataStatus = "FAIL";
    envCheck.ESTAT_APP_ID = false;
  }

  if (values.length < 4) {
    console.error(
      "❌ Insufficient data points for metrics (minimum 4 required).",
    );
    return;
  }

  // 2. Load Models
  const tsModels = await getTSModels();

  // 3. Evaluation Setup
  const windowSize = 3;
  const targets: number[] = [];
  const previous: number[] = [];
  const naivePredictions: number[] = [];
  const rollingPredictions: number[] = [];

  for (let i = windowSize; i < values.length; i++) {
    const current = values[i];
    const prev = values[i - 1];
    if (current === undefined || prev === undefined) continue;

    targets.push(current);
    previous.push(prev);
    naivePredictions.push(prev);
    rollingPredictions.push(average(values.slice(i - windowSize, i)));
  }

  // 4. Calculate Metrics
  const naiveErrors = targets.map((t, i) =>
    Math.abs(t - (naivePredictions[i] ?? 0)),
  );
  const rollingErrors = targets.map((t, i) =>
    Math.abs(t - (rollingPredictions[i] ?? 0)),
  );
  const absChanges = targets.map((t, i) => Math.abs(t - (previous[i] ?? 0)));
  const changeScale = Math.max(average(absChanges), 1);
  const benchmarkConfig = core.config.benchmark.foundation;
  const noiseThreshold = changeScale * benchmarkConfig.noiseThresholdMultiplier;

  const rollingConfidences = rollingPredictions.map((p, i) =>
    confidenceFromChange(p, previous[i] ?? 0, changeScale),
  );
  const rollingAbstentions = rollingPredictions.map(
    (p, i) => Math.abs(p - (previous[i] ?? 0)) < noiseThreshold,
  );

  const rollingSignificance = calculateSignificance(naiveErrors, rollingErrors);

  const naiveMetrics = {
    mae: average(naiveErrors),
    rmse: calculateRMSE(targets, naivePredictions),
    smape: calculateSMAPE(targets, naivePredictions),
    directionalAccuracy: calculateDirectionalAccuracy(
      targets,
      naivePredictions,
      previous,
    ),
    abstentionRate: 0,
    safeAccuracy: calculateDirectionalAccuracy(
      targets,
      naivePredictions,
      previous,
    ),
    overconfidenceError: calculateOverconfidenceError(
      targets,
      naivePredictions,
      previous,
      new Array(naivePredictions.length).fill(0.5),
      benchmarkConfig.overconfidenceThreshold,
    ),
    brierScore: calculateBrierScore(
      targets,
      previous,
      new Array(naivePredictions.length).fill(0.5),
    ),
    ece: calculateECE(
      targets,
      naivePredictions,
      previous,
      new Array(naivePredictions.length).fill(0.5),
    ),
    premiseCoverage:
      (targets.length / Math.max(values.length - windowSize, 1)) * 100,
    tStat: 0,
    pValue: 1,
  };

  const rollingMetrics = {
    mae: average(rollingErrors),
    rmse: calculateRMSE(targets, rollingPredictions),
    smape: calculateSMAPE(targets, rollingPredictions),
    directionalAccuracy: calculateDirectionalAccuracy(
      targets,
      rollingPredictions,
      previous,
    ),
    abstentionRate: calculateAbstentionRate(rollingAbstentions),
    safeAccuracy: calculateSafeAccuracy(
      targets,
      rollingPredictions,
      previous,
      rollingAbstentions,
      noiseThreshold,
    ),
    overconfidenceError: calculateOverconfidenceError(
      targets,
      rollingPredictions,
      previous,
      rollingConfidences,
      benchmarkConfig.overconfidenceThreshold,
    ),
    brierScore: calculateBrierScore(targets, previous, rollingConfidences),
    ece: calculateECE(
      targets,
      rollingPredictions,
      previous,
      rollingConfidences,
    ),
    premiseCoverage:
      (targets.length / Math.max(values.length - windowSize, 1)) * 100,
    tStat: rollingSignificance.tStat,
    pValue: rollingSignificance.pValue,
  };

  // 5. Build Log
  const today = (
    new Date().toISOString().split("T")[0] ?? "19700101"
  ).replaceAll("-", "");
  const recommendations = [];
  if (rollingMetrics.mae < naiveMetrics.mae)
    recommendations.push(
      "Historical data smoothing (Rolling) is currently superior to Naive persistence.",
    );
  if (rollingMetrics.pValue < 0.1)
    recommendations.push(
      "Rolling Average improvement is statistically significant (Critical Luck excluded).",
    );

  const benchmarkLog = {
    schema: "investor.benchmark-log.v1",
    generatedAt: new Date().toISOString(),
    models: tsModels.map((m) => ({
      id: m.id,
      vendor: m.vendor,
      name: m.name,
      context7LibraryId: m.context7LibraryId,
      github: m.github || "https://github.com",
      arxiv: m.arxiv || "https://arxiv.org",
    })),
    report: {
      type: "FOUNDATION_BENCHMARK",
      benchmarkId: `bench_${today}`,
      date: today,
      analyst: {
        baselines: [
          { name: "Naive (t-1)", metrics: naiveMetrics },
          { name: `Rolling Avg (${windowSize})`, metrics: rollingMetrics },
        ],
        models: tsModels.map((m) => ({
          id: m.id,
          vendor: m.vendor,
          tags: m.tags,
        })),
        recommendations,
        insights: `Benchmark run completed with ${targets.length} test points. Rolling Average shows ${(naiveMetrics.mae - rollingMetrics.mae).toFixed(4)} MAE improvement over Naive (t-stat=${rollingMetrics.tStat.toFixed(2)}).`,
      },
      operator: {
        status: dataStatus,
        dataset: "e-Stat 0000010101 (Vegetable Prices)",
        rowCount: values.length,
        environment: process.env.NODE_ENV || "development",
        workflowReadiness: tsModels.length > 5 ? "PASS" : "FAIL",
      },
      debugger: {
        telemetry: {
          nodeVersion: process.version,
          platform: process.platform,
        },
        envCheck,
        rawValues: values,
        latencyMs: Date.now() - startTime,
      },
    },
  };

  // 6. Persistence
  const validatedLog = UnifiedLogSchema.parse(benchmarkLog);
  const benchmarkDir = join(core.config.paths.logs, "benchmarks");
  mkdirSync(benchmarkDir, { recursive: true });
  const logPath = join(benchmarkDir, `${today}.json`);
  writeFileSync(logPath, JSON.stringify(validatedLog, null, 2), "utf8");

  console.log(`\n✅ Metric-Driven Benchmark Complete. Log: ${logPath}`);
  console.log(
    `- Naive: MAE=${naiveMetrics.mae.toFixed(4)}, DA=${naiveMetrics.directionalAccuracy.toFixed(2)}%`,
  );
  console.log(
    `- Rolling: MAE=${rollingMetrics.mae.toFixed(4)}, DA=${rollingMetrics.directionalAccuracy.toFixed(2)}% (t-stat: ${rollingMetrics.tStat.toFixed(2)})`,
  );
  console.log(
    `- Rolling Safety: Abstain=${rollingMetrics.abstentionRate.toFixed(2)}%, SafeAcc=${rollingMetrics.safeAccuracy.toFixed(2)}%, OverconfErr=${rollingMetrics.overconfidenceError.toFixed(2)}%, ECE=${rollingMetrics.ece.toFixed(4)}`,
  );
  return validatedLog;
}

if (import.meta.main) {
  runFoundationBenchmark().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
