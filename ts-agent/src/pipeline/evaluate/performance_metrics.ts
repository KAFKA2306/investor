import type { z } from "zod";
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
