import type {
  AllocationRequest,
  AllocationResult,
  InvestmentIdea,
} from "../schemas/allocation_schema.ts";
import { logger } from "../utils/logger.ts";

/**
 * ✨ Allocator handles optimal portfolio allocation! ✨
 */
export class Allocator {
  private readonly log = logger.child({ component: "Allocator" });

  /**
   * Calculates allocation based on the Kelly Criterion for the given request! 📊
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
   * Calculates individual weights using the Kelly Criterion formula! 📐
   * f* = (p * (b + 1) - 1) / b
   * p: Winning probability (confidence)
   * b: Return at take-profit / Loss at stop-loss (expected_return / volatility)
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

    // Define odds 'b' as the return/risk ratio!
    const b = expectedReturn / volatility;

    if (b <= 0) {
      this.log.debug("Kelly b is <= 0", { ticker: idea.ticker, b });
      return 0; // If expected return is not positive, it's correct not to bet! 💢
    }

    // ケリーの公式: f* = p - (1-p)/b
    const kellyWeight = p - (1.0 - p) / b;
    this.log.debug("Kelly weight calculated", {
      ticker: idea.ticker,
      p,
      b,
      kellyWeight,
    });
    return Math.max(0, kellyWeight); // Negative weights (short selling) are not considered here 🛡️
  }

  /**
   * Normalize all weights so the total sum is 1.0 (100%)! ✨
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
