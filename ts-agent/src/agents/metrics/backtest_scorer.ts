/**
 * Backtest Score Metric
 *
 * Normalizes Sharpe Ratio and Information Coefficient (IC) to [0, 1] range
 * and computes an aggregate backtest quality score.
 *
 * Thresholds:
 * - Sharpe Ratio: min=1.5, ideal=2.0
 * - IC: min=0.04, ideal=0.08
 *
 * Scoring:
 * - Score at min threshold = 0.0
 * - Score at ideal threshold = 1.0
 * - Scores above ideal are clipped to 1.0
 * - Final score is the average of normalized Sharpe and IC scores
 */

const BACKTEST_THRESHOLDS = {
  sharpe: { min: 1.5, ideal: 2.0 },
  ic: { min: 0.04, ideal: 0.08 },
} as const;

/**
 * Normalize a value to [0, 1] range based on min and ideal thresholds
 * @param value - The value to normalize
 * @param min - Minimum acceptable value (maps to 0.0)
 * @param ideal - Ideal/maximum value (maps to 1.0)
 * @returns Normalized score in [0, 1] range
 */
function normalizeScore(value: number, min: number, ideal: number): number {
  // If value is below min, return 0
  if (value <= min) {
    return 0;
  }

  // If value is at or above ideal, return 1
  if (value >= ideal) {
    return 1;
  }

  // Linear interpolation between min and ideal
  return (value - min) / (ideal - min);
}

/**
 * Compute backtest score from Sharpe Ratio and Information Coefficient
 *
 * @param sharpeRatio - Sharpe ratio of the backtest
 * @param informationCoefficient - Information coefficient (IC) of the backtest
 * @returns Aggregated backtest score in [0, 1] range
 */
export function computeBacktestScore(
  sharpeRatio: number,
  informationCoefficient: number,
): number {
  // Normalize Sharpe ratio
  const sharpeScore = normalizeScore(
    sharpeRatio,
    BACKTEST_THRESHOLDS.sharpe.min,
    BACKTEST_THRESHOLDS.sharpe.ideal,
  );

  // Normalize IC
  const icScore = normalizeScore(
    informationCoefficient,
    BACKTEST_THRESHOLDS.ic.min,
    BACKTEST_THRESHOLDS.ic.ideal,
  );

  // Return average of both scores
  return (sharpeScore + icScore) / 2;
}
