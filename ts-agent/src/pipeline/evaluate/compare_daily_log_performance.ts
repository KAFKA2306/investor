import { resolve } from "node:path";
import { z } from "zod";
import { core } from "../../system/app_runtime_core.ts";
import { loadPerformanceLedgerRows } from "./performance_ledger_loader.ts";
import {
  calculatePerformanceMetrics,
  calculatePerformanceMetricsFromLedger,
  PerformanceMetricsSchema,
} from "./performance.ts";
} from "./performance_metrics_evaluator.ts";

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
  ledgerQuality: z.object({
    rowCount: z.number().int().nonnegative(),
    missingCostRows: z.number().int().nonnegative(),
    missingExposureRows: z.number().int().nonnegative(),
  }),
});

export function runDailyAbComparison(logsBaseDir: string) {
  const logsDir = resolve(logsBaseDir, "daily");
  const ledgerRows = loadPerformanceLedgerRows(logsDir);
  if (ledgerRows.length < 1) {
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
      ledgerQuality: {
        rowCount: 0,
        missingCostRows: 0,
        missingExposureRows: 0,
      },
    });
  }
  const baselineRows = ledgerRows.map((row) => ({
    ...row,
    netReturn: 0,
  }));
  const baseline = calculatePerformanceMetricsFromLedger(baselineRows);
  const candidate = calculatePerformanceMetricsFromLedger(ledgerRows);
  const missingCostRows = ledgerRows.filter(
    (row) => row.totalCostBps <= 0,
  ).length;
  const missingExposureRows = ledgerRows.filter(
    (row) => row.grossExposure <= 0,
  ).length;
  const report = ComparisonReportSchema.parse({
    generatedAt: new Date().toISOString(),
    dateRange: {
      from: ledgerRows[0]?.date ?? "19700101",
      to: ledgerRows[ledgerRows.length - 1]?.date ?? "19700101",
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
    ledgerQuality: {
      rowCount: ledgerRows.length,
      missingCostRows,
      missingExposureRows,
    },
  });
  return report;
}

if (import.meta.main) {
  const logsBaseDir = core.config.paths.logs;
  const report = runDailyAbComparison(logsBaseDir);
  console.log(JSON.stringify(report, null, 2));
}
