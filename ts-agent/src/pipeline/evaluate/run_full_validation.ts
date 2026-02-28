import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluatePromotionGate,
  toPromotionInput,
} from "../../backtest/promotion_gate.ts";
import { core } from "../../core/index.ts";
import { compareForecastAndOutcome } from "../../experiments/02_comparison.ts";
import { runTimeSeriesAnalysis } from "../../experiments/03_timeseries_analysis.ts";
import { runApiVerification } from "../../experiments/api_verify.ts";
import {
  UnifiedRunLogSchema,
  type UnifiedStageLog,
} from "../../schemas/unified_run_log.ts";
import { runVegetableProof } from "../../use_cases/run_vegetable_proof.ts";
import { runFactorMining } from "../factor_mining/evolve_candidates.ts";
import { runDailyAbComparison } from "./ab_compare_daily_logs.ts";
import { runFoundationBenchmark } from "./foundation_benchmark.ts";
import { runLlmAgentReadiness } from "./llm_agent_readiness.ts";

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function metricOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function runStage(
  stageId: string,
  category: UnifiedStageLog["category"],
  name: string,
  fn: () => Promise<{ metrics: Record<string, number>; detail?: unknown }>,
): Promise<UnifiedStageLog> {
  const startedAt = new Date().toISOString();
  try {
    const res = await fn();
    return {
      stageId,
      category,
      name,
      status: "PASS",
      startedAt,
      endedAt: new Date().toISOString(),
      metrics: res.metrics,
      detail: res.detail,
    };
  } catch (error) {
    return {
      stageId,
      category,
      name,
      status: "FAIL",
      startedAt,
      endedAt: new Date().toISOString(),
      metrics: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runFullValidation(logsBaseDir: string) {
  const runDate = yyyymmdd(new Date());
  const runId = `run_${runDate}_${Date.now()}`;

  const stages: UnifiedStageLog[] = [];
  let abReportRef: ReturnType<typeof runDailyAbComparison> | null = null;
  let readinessReportRef: ReturnType<typeof runLlmAgentReadiness> | null = null;
  stages.push(
    await runStage(
      "verify_api",
      "verification",
      "API Verification",
      async () => {
        const report = await runApiVerification();
        const passCount = [
          report.jquants.status,
          report.kabucom.status,
          report.edinet.status,
          report.estat.status,
        ].filter((s) => s === "PASS").length;
        return {
          metrics: {
            passCount,
            totalTargets: 4,
            jquantsListedCount: metricOrZero(report.jquants.listedCount),
          },
          detail: report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "scenario_daily",
      "scenario",
      "Vegetable Daily Scenario",
      async () => {
        const log = await runVegetableProof();
        if (!("results" in log.report)) {
          return { metrics: {}, detail: log };
        }
        return {
          metrics: {
            expectedEdge: metricOrZero(log.report.results.expectedEdge),
            basketDailyReturn: metricOrZero(
              log.report.results.basketDailyReturn,
            ),
            selectedCount: log.report.results.selectedSymbols.length,
          },
          detail: log.report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "experiment_comparison",
      "experiment",
      "Forecast vs Outcome",
      async () => {
        const report = await compareForecastAndOutcome();
        const latest = report.rows[report.rows.length - 1];
        return {
          metrics: {
            rows: report.rows.length,
            latestAccuracyRatio: metricOrZero(latest?.accuracy),
          },
          detail: report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "experiment_timeseries",
      "experiment",
      "Time Series Analysis",
      async () => {
        const report = await runTimeSeriesAnalysis(false);
        return {
          metrics: {
            dataPoints: report.dataPoints,
            naiveMae: report.naiveMae,
            rollingMae: report.rollingMae,
            rollingBeatsNaive: report.rollingBeatsNaive ? 1 : 0,
          },
          detail: report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "pipeline_ab",
      "pipeline",
      "Daily A/B Comparison",
      async () => {
        const report = runDailyAbComparison(logsBaseDir);
        abReportRef = report;
        return {
          metrics: {
            sharpeDelta: report.uplift.sharpeDelta,
            cumulativeReturnDelta: report.uplift.cumulativeReturnDelta,
            winRateDelta: report.uplift.winRateDelta,
          },
          detail: report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "pipeline_readiness",
      "pipeline",
      "LLM Readiness",
      async () => {
        const report = runLlmAgentReadiness(logsBaseDir);
        readinessReportRef = report;
        return {
          metrics: {
            total: report.score.total,
            dataHorizon: report.score.dataHorizon,
            costAwareness: report.score.costAwareness,
          },
          detail: report,
        };
      },
    ),
  );

  stages.push(
    await runStage(
      "pipeline_promotion",
      "pipeline",
      "Promotion Gate",
      async () => {
        const abReport = abReportRef ?? runDailyAbComparison(logsBaseDir);
        const readinessReport =
          readinessReportRef ?? runLlmAgentReadiness(logsBaseDir);
        const input = toPromotionInput({
          readinessReport,
          candidateMetrics: abReport.candidate.metrics,
          ledgerQuality: abReport.ledgerQuality,
        });
        const decision = evaluatePromotionGate(input);
        return {
          metrics: {
            allocationTier: decision.allocationTier,
            targetGrossExposureMultiplier:
              decision.targetGrossExposureMultiplier,
            riskBudgetBps: decision.riskBudgetBps,
          },
          detail: {
            decision,
            gateInput: input,
          },
        };
      },
    ),
  );

  stages.push(
    await runStage("pipeline_mining", "pipeline", "Factor Mining", async () => {
      const report = runFactorMining(
        logsBaseDir,
        resolve(process.cwd(), "src/model_registry"),
      );
      return {
        metrics: {
          rows: report.source.rows,
          acceptedCount: report.acceptedCount,
          topSharpe: metricOrZero(report.top[0]?.sharpe),
        },
        detail: report,
      };
    }),
  );

  stages.push(
    await runStage(
      "pipeline_foundation",
      "pipeline",
      "Foundation Benchmark",
      async () => {
        const report = await runFoundationBenchmark();
        if (!report) {
          throw new Error("Foundation benchmark did not produce a log.");
        }
        if (!("analyst" in report.report) || !("operator" in report.report)) {
          throw new Error(
            "Foundation benchmark returned unexpected report shape.",
          );
        }
        const baselines = report.report.analyst.baselines;
        const naive = baselines.find((b) => b.name.includes("Naive"));
        const rolling = baselines.find((b) => b.name.includes("Rolling"));
        const compactDetail = {
          type: report.report.type,
          benchmarkId: report.report.benchmarkId,
          date: report.report.date,
          operator: report.report.operator,
          analyst: {
            baselines: report.report.analyst.baselines,
            recommendations: report.report.analyst.recommendations,
            insights: report.report.analyst.insights,
          },
        };
        return {
          metrics: {
            rowCount: report.report.operator.rowCount,
            rollingMae: metricOrZero(rolling?.metrics.mae),
            naiveMae: metricOrZero(naive?.metrics.mae),
            rollingPValue: metricOrZero(rolling?.metrics.pValue),
          },
          detail: compactDetail,
        };
      },
    ),
  );

  const runLog = UnifiedRunLogSchema.parse({
    schema: "investor.unified-log.v1",
    generatedAt: new Date().toISOString(),
    date: runDate,
    runId,
    stages,
  });

  const outDir = resolve(logsBaseDir, "unified");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${runDate}.json`);
  writeFileSync(outPath, `${JSON.stringify(runLog, null, 2)}\n`, "utf8");
  return { runLog, outPath };
}

if (import.meta.main) {
  const logsBaseDir = core.config.paths.logs;
  runFullValidation(logsBaseDir)
    .then((result) => {
      console.log(JSON.stringify(result.runLog, null, 2));
      console.log(`Unified run log written to ${result.outPath}`);
    })
    .catch((error) => {
      console.error("run_full_validation failed", error);
      process.exit(1);
    });
}
