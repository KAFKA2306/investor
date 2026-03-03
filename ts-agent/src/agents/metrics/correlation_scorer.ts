/**
 * Correlation Score Metric
 *
 * Computes how well factors correlate with returns using Pearson correlation
 * coefficient. The score is normalized to [0, 1] range where 1 indicates
 * perfect correlation and 0 indicates no correlation.
 */

/**
 * Computes Pearson correlation coefficient between two arrays.
 * Formula: correlation = sum((x - mean_x) * (y - mean_y)) / sqrt(sum((x - mean_x)^2) * sum((y - mean_y)^2))
 *
 * @param x - First array of numbers
 * @param y - Second array of numbers
 * @returns Pearson correlation coefficient in range [-1, 1], or NaN if undefined
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) {
    return Number.NaN;
  }

  const n = x.length;

  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate deviations and their products
  let sumProduct = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const devX = x[i]! - meanX;
    const devY = y[i]! - meanY;
    sumProduct += devX * devY;
    sumSqX += devX * devX;
    sumSqY += devY * devY;
  }

  // Handle zero variance case
  if (sumSqX === 0 || sumSqY === 0) {
    return Number.NaN;
  }

  const correlation = sumProduct / Math.sqrt(sumSqX * sumSqY);
  return correlation;
}

/**
 * Computes correlation score for multiple factors against returns.
 * Each factor's absolute correlation with returns is computed, then
 * averaged and normalized to [0, 1] range.
 *
 * Normalization factor: 0.3 represents typical correlation threshold.
 * This maps [-1, 1] absolute correlation to [0, 1] score.
 *
 * @param factors - 2D array where each row is a factor's values across observations
 * @param returns - 1D array of return values
 * @returns Normalized correlation score in range [0, 1]
 */
export function computeCorrelationScore(
  factors: number[][],
  returns: number[],
): number {
  if (factors.length === 0 || returns.length === 0) {
    return 0;
  }

  // Validate input dimensions
  for (const factor of factors) {
    if (factor.length !== returns.length) {
      return 0;
    }
  }

  // Handle all-zero factors case
  const hasNonZeroFactor = factors.some((factor) =>
    factor.some((val) => val !== 0),
  );
  if (!hasNonZeroFactor) {
    return 0;
  }

  // Compute absolute correlation for each factor
  const correlations: number[] = [];

  for (const factor of factors) {
    const correlation = pearsonCorrelation(factor, returns);

    // Skip NaN correlations (e.g., constant arrays)
    if (!Number.isNaN(correlation)) {
      correlations.push(Math.abs(correlation));
    }
  }

  // If all correlations were NaN, return 0
  if (correlations.length === 0) {
    return 0;
  }

  // Calculate average absolute correlation
  const averageAbsCorrelation =
    correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;

  // Normalize to [0, 1] using 0.3 as the normalization factor
  // This maps typical correlation magnitudes to a [0, 1] range
  const normalizationFactor = 0.3;
  const normalizedScore = Math.min(
    1,
    averageAbsCorrelation / normalizationFactor,
  );

  return normalizedScore;
}
