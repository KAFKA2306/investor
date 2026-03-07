/**
 * Backtest Score Metric
 *
 * Normalizes Sharpe Ratio to [0, 1] range
 * and computes a backtest quality score.
 *
 * Thresholds:
 * - Sharpe Ratio: min=1.5, ideal=2.0
 *
 * Scoring:
 * - Score at min threshold = 0.0
 * - Score at ideal threshold = 1.0
 * - Scores above ideal are clipped to 1.0
 * - Final score is based on normalized Sharpe score
 */

const BACKTEST_THRESHOLDS = {
  sharpe: { min: 1.5, ideal: 2.0 },
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
 * Compute backtest score from Sharpe Ratio
 *
 * @param sharpeRatio - Sharpe ratio of the backtest
 * @returns Aggregated backtest score in [0, 1] range
 */
export function computeBacktestScore(sharpeRatio: number): number {
  // Normalize Sharpe ratio
  const sharpeScore = normalizeScore(
    sharpeRatio,
    BACKTEST_THRESHOLDS.sharpe.min,
    BACKTEST_THRESHOLDS.sharpe.ideal,
  );

  // Return sharpe score
  return sharpeScore;
}
