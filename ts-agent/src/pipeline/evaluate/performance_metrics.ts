import type { z } from "zod";
import type { PerformanceLedgerRow } from "../backtest/performance_ledger.ts";
import { evaluate } from "../../domain/performance.ts";
import {
  type DailyLog,
  EvaluationResultSchema,
} from "../../schemas/performance_schema.ts";

export const PerformanceMetricsSchema = EvaluationResultSchema;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export function calculatePerformanceMetrics(
  returns: readonly number[],
  benchmarks?: readonly number[],
): PerformanceMetrics {
  const logs: DailyLog[] = returns.map((r, i) => ({
    date: "20000101", // Placeholder
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
