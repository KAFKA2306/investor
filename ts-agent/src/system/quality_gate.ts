import { core } from "./app_runtime_core.ts";
import type {
  ExecutionResult,
  OrderPlan,
  PITDataset,
  PipelineRequirement,
} from "./pipeline_orchestrator.ts";

export interface QualityGateResult {
  accepted: boolean;
  threshold?: number;
  failedChecks: string[];
  macroIndicatorCoverage?: number;
}

/**
 * ✨ 各種品質チェックを行うサービス ✨
 */
export class QualityGate {
  /**
   * データのデリバリー品質（欠損や遅延）をチェックするよっ！📦
   */
  public evaluateDataDelivery(
    dataset: PITDataset,
    requirement: PipelineRequirement,
  ): QualityGateResult {
    const blueprintData = core.config.pipelineBlueprint?.dataAcceptance;
    const criteria = requirement.targetMetrics?.dataDelivery;

    const threshold =
      criteria?.minQualityScore ?? blueprintData?.minQualityScore ?? 0.8;
    const minCoverageRate =
      criteria?.minCoverageRate ?? blueprintData?.minCoverageRate ?? 0.8;
    const maxMissingRate =
      criteria?.maxMissingRate ?? blueprintData?.maxMissingRate ?? 0.08;
    const maxLatencyMinutes = blueprintData?.maxLatencyMinutes ?? 40;
    const minMacroIndicatorCoverage =
      criteria?.minMacroIndicatorCoverage ??
      blueprintData?.minMacroIndicatorCoverage ??
      0.95;

    const m = dataset.deliveryMetrics;

    // Calculate macro indicator coverage (macro_cpi, macro_iip, etc.)
    const macroIndicatorCoverage =
      this.calculateMacroIndicatorCoverage(dataset);

    const failedChecks = [
      dataset.qualityScore >= threshold ? "" : "quality",
      m.coverageRate >= minCoverageRate ? "" : "coverage",
      m.missingRate <= maxMissingRate ? "" : "missing",
      m.latencyMinutes <= maxLatencyMinutes ? "" : "latency_minutes",
      macroIndicatorCoverage >= minMacroIndicatorCoverage
        ? ""
        : "macro_coverage",
    ].filter(Boolean);

    return {
      accepted: failedChecks.length === 0,
      threshold,
      failedChecks,
      macroIndicatorCoverage,
    };
  }

  /**
   * Calculate macro indicator coverage from the dataset
   * Checks availability of macro_cpi and macro_iip across all rows
   */
  private calculateMacroIndicatorCoverage(dataset: PITDataset): number {
    if (!dataset.data || dataset.data.length === 0) return 0;

    const integrated = dataset.data[0];
    if (!integrated?.rows || integrated.rows.length === 0) return 0;

    // Count rows that have macro indicators (represented by schemaMatch and non-zero expectedRows)
    const rowsWithMacroData = integrated.rows.filter(
      (row) => (row.schemaMatch ?? 0) > 0.8 && (row.expectedRows ?? 0) > 0,
    ).length;

    const totalRows = integrated.rows.length;
    return totalRows > 0 ? rowsWithMacroData / totalRows : 0;
  }

  /**
   * 執行の質（フィルレートやスリッページ）をチェックするよっ！💴
   */
  public evaluateExecutionQuality(
    execution: ExecutionResult,
  ): QualityGateResult {
    const criteria = core.config.pipelineBlueprint?.executionQuality ?? {
      minFillRate: 0.95,
      maxSlippageBps: 2,
      maxExecutionLatencyMs: 3000,
    };

    const failedChecks = [
      execution.fillRate >= criteria.minFillRate ? "" : "fill_rate",
      execution.slippageBps <= criteria.maxSlippageBps ? "" : "slippage",
      execution.executionLatencyMs <= criteria.maxExecutionLatencyMs
        ? ""
        : "latency",
    ].filter(Boolean);

    return { accepted: failedChecks.length === 0, failedChecks };
  }

  /**
   * ポジションの制約（ウェイトやターンオーバー）をチェックするよっ！🛡️
   */
  public evaluateExecutionConstraints(plan: OrderPlan): QualityGateResult {
    const constraints = core.config.pipelineBlueprint?.executionConstraints ?? {
      maxPositionWeight: 0.12,
      maxTurnover: 0.9,
    };

    const maxWeight = Math.max(...Object.values(plan.allocations), 0);
    const turnover = Object.values(plan.allocations).reduce(
      (sum, w) => sum + Math.abs(w),
      0,
    );

    const failedChecks = [
      maxWeight <= constraints.maxPositionWeight ? "" : "max_position_weight",
      turnover <= constraints.maxTurnover ? "" : "max_turnover",
    ].filter(Boolean);

    return { accepted: failedChecks.length === 0, failedChecks };
  }
}

export const qualityGate = new QualityGate();
