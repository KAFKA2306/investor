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

    const m = dataset.deliveryMetrics;
    const failedChecks = [
      dataset.qualityScore >= threshold ? "" : "quality",
      m.coverageRate >= minCoverageRate ? "" : "coverage",
      m.missingRate <= maxMissingRate ? "" : "missing",
      m.latencyMinutes <= maxLatencyMinutes ? "" : "latency_minutes",
    ].filter(Boolean);

    return {
      accepted: failedChecks.length === 0,
      threshold,
      failedChecks,
    };
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
