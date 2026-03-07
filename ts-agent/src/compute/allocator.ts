import type {
  AllocationRequest,
  AllocationResult,
  InvestmentIdea,
} from "../schemas/allocation_schema.ts";
import { logger } from "../utils/logger.ts";

/**
 * ✨ ポートフォリオの最適配分を担当する Allocator くん！ ✨
 */
export class Allocator {
  private readonly log = logger.child({ component: "Allocator" });

  /**
   * 与えられたリクエストに基づいて、ケリー基準（Kelly Criterion）で配分を計算するよっ！📊
   */
  public allocate(request: AllocationRequest): AllocationResult[] {
    this.log.info("Starting allocation calculation", {
      ideaCount: request.ideas.length,
      totalCapital: request.totalCapital,
    });

    if (request.ideas.length === 0) {
      return [];
    }

    const results: AllocationResult[] = request.ideas.map((idea) => {
      const weight = this._calculateKelly(idea);
      return {
        ticker: idea.ticker,
        weight: weight,
        amount: request.totalCapital * weight,
        reasoning: `Kelly weight based on confidence ${(idea.confidence * 100).toFixed(1)}%`,
      };
    });

    const normalized = this._normalize(results, request.totalCapital);

    this.log.info("Allocation completed", {
      resultSummaries: normalized
        .map((r) => `${r.ticker}: ${(r.weight * 100).toFixed(2)}%`)
        .join(", "),
    });

    return normalized;
  }

  /**
   * ケリー基準の公式を使って、個別の重みを計算するよっ！📐
   * f* = (p * (b + 1) - 1) / b
   * p: 成功確率 (confidence)
   * b: 利益確定時リターン / 損切り時損失 (expected_return / volatility)
   */
  private _calculateKelly(idea: InvestmentIdea): number {
    const p = idea.confidence;

    const expectedReturn = idea.expectedReturn;
    const volatility = idea.volatility;

    this.log.debug("Kelly calculation inputs", {
      ticker: idea.ticker,
      p,
      expectedReturn,
      volatility,
    });

    if (
      expectedReturn === undefined ||
      volatility === undefined ||
      p === undefined
    ) {
      this.log.error("Missing required fields for Kelly calculation", {
        ticker: idea.ticker,
      });
      return 0;
    }

    // オッズ b をリターン/リスクの比率として定義するよっ！
    const b = expectedReturn / volatility;

    if (b <= 0) {
      this.log.debug("Kelly b is <= 0", { ticker: idea.ticker, b });
      return 0; // 期待リターンがプラスじゃないなら、賭けないのが正解だよっ！💢
    }

    // ケリーの公式: f* = p - (1-p)/b
    const kellyWeight = p - (1.0 - p) / b;
    this.log.debug("Kelly weight calculated", {
      ticker: idea.ticker,
      p,
      b,
      kellyWeight,
    });
    return Math.max(0, kellyWeight); // マイナスの重み（空売り）は今回は考慮しないよっ🛡️
  }

  /**
   * すべての重みの合計が 1.0 (100%) になるように調整するよっ！✨
   */
  private _normalize(
    results: AllocationResult[],
    totalCapital: number,
  ): AllocationResult[] {
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);

    if (totalWeight === 0) {
      this.log.warn("Total weight is zero, no allocation possible");
      return results;
    }

    for (const r of results) {
      r.weight /= totalWeight;
      r.amount = r.weight * totalCapital;
    }

    return results;
  }
}
