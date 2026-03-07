/**
 * Constraint Scorer Module
 * Evaluates backtest metrics against predefined constraint thresholds.
 *
 * This module implements a constraint satisfaction metric that checks:
 * - Sharpe Ratio >= 1.5
 * - Maximum Drawdown <= 0.10
 *
 * The constraint score is calculated as a proportion of satisfied constraints,
 * with additional penalty/boost based on margin of satisfaction.
 */

/**
 * Constraint thresholds for backtest metrics
 * These represent the minimum acceptable quality standards for an alpha factor
 */
const CONSTRAINT_THRESHOLDS = {
  sharpeRatio: { min: 1.5 },
  maxDrawdown: { max: 0.1 },
} as const;

/**
 * Backtest metrics interface
 * Represents key performance indicators from alpha factor backtests
 */
export interface BacktestMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
}

/**
 * Check if a single constraint is satisfied
 */
function isConstraintSatisfied(
  metricValue: number,
  constraint: { min?: number; max?: number },
): boolean {
  if (constraint.min !== undefined && metricValue < constraint.min) {
    return false;
  }
  if (constraint.max !== undefined && metricValue > constraint.max) {
    return false;
  }
  return true;
}

/**
 * Compute the constraint satisfaction score
 *
 * Scoring logic:
 * 1. Each constraint is evaluated as satisfied (1 point) or not (0 points)
 * 2. Base score = number of satisfied constraints / total constraints (0.0 - 1.0)
 * 3. For unsatisfied constraints, calculate proximity score (0.0-1.0) based on
 *    how close the metric is to the threshold:
 *    - Sharpe: (value / 1.5) capped at 1.0
 *    - MaxDD: ((0.1 - value) / 0.1) capped at 1.0
 * 4. Final score = (satisfied_count + sum_of_proximity_scores) / total_constraints
 *
 * Result ranges:
 * - 1.0: All constraints satisfied
 * - 0.67-0.99: Two+ constraints satisfied or one satisfied with good proximity
 * - 0.33-0.66: One+ constraints satisfied or multiple close to threshold
 * - 0.0-0.32: All constraints far from thresholds or all violated
 *
 * @param metrics - BacktestMetrics containing Sharpe and MaxDrawdown
 * @returns Score between 0.0 and 1.0
 */
export function computeConstraintScore(metrics: BacktestMetrics): number {
  const constraints = [
    {
      name: "sharpeRatio",
      value: metrics.sharpeRatio,
      constraint: CONSTRAINT_THRESHOLDS.sharpeRatio,
    },
    {
      name: "maxDrawdown",
      value: metrics.maxDrawdown,
      constraint: CONSTRAINT_THRESHOLDS.maxDrawdown,
    },
  ];

  let totalScore = 0;

  for (const { value, constraint } of constraints) {
    const isSatisfied = isConstraintSatisfied(value, constraint);

    if (isSatisfied) {
      // Constraint is satisfied: full 1.0 points
      totalScore += 1.0;
    } else {
      // Constraint not satisfied: award proximity score
      let proximityScore = 0;

      if ("min" in constraint && constraint.min !== undefined) {
        // For minimums (Sharpe >= 1.5, etc.)
        proximityScore = Math.max(0, Math.min(value / constraint.min, 1.0));
      } else if ("max" in constraint && constraint.max !== undefined) {
        // For maximums (MaxDD <= 0.1)
        proximityScore = Math.max(
          0,
          Math.min((constraint.max - value) / constraint.max, 1.0),
        );
      }

      totalScore += proximityScore;
    }
  }

  // Final score is average across all constraints
  return totalScore / constraints.length;
}
