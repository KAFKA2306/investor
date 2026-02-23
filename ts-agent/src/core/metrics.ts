/**
 * Generalized Quant Metrics (Numerai-style)
 *
 * Provides CORR, MMC, and FNC calculations for verifiable model evaluation.
 */

export class QuantMetrics {
  /**
   * CORR: Gauss-ranked, tail-emphasized correlation
   * Emphasizes the most confident predictions.
   */
  public static calculateCorr(
    predictions: number[],
    targets: number[],
  ): number {
    if (predictions.length !== targets.length) return 0;

    // Gauss Rank transformation (simple approximation)
    const rankedPreds = QuantMetrics.gaussRank(predictions);
    const rankedTargets = QuantMetrics.gaussRank(targets);

    // Pearson Correlation on ranked data
    return QuantMetrics.pearson(rankedPreds, rankedTargets);
  }

  /**
   * MMC: Meta-Model Contribution
   * measures unique alpha against a baseline (system-wide Meta Model).
   */
  public static calculateMMC(
    preds: number[],
    metaModelPreds: number[],
    targets: number[],
  ): number {
    // Neutralize preds to metaModelPreds
    const neutralized = QuantMetrics.neutralize(preds, metaModelPreds);
    return QuantMetrics.calculateCorr(neutralized, targets);
  }

  /**
   * FNC: Feature Neutral Correlation
   * Measures predictive power that is NOT explained by linear exposure to features.
   */
  public static calculateFNC(
    preds: number[],
    features: number[][],
    targets: number[],
  ): number {
    let neutralized = [...preds];
    for (const feature of features) {
      neutralized = QuantMetrics.neutralize(neutralized, feature);
    }
    return QuantMetrics.calculateCorr(neutralized, targets);
  }

  private static gaussRank(data: number[]): number[] {
    const sorted = [...data].sort((a, b) => a - b);
    return data.map((v) => {
      const rank = sorted.indexOf(v) / (data.length - 1);
      // Inverse Normal CDF approximation
      return QuantMetrics.invNormalCdf(rank);
    });
  }

  private static neutralize(preds: number[], features: number[]): number[] {
    const len = Math.min(preds.length, features.length);
    const p = preds.slice(0, len);
    const f = features.slice(0, len);

    // 1D Linear Regression residual: Y - (beta * X)
    const varF = QuantMetrics.variance(f);
    if (varF === 0) return p;

    const b = QuantMetrics.covariance(p, f) / varF;
    return p.map((val, i) => {
      const fi = f[i];
      return fi !== undefined ? val - b * fi : val;
    });
  }

  private static invNormalCdf(p: number): number {
    // Simple Approximation for Gauss Ranking
    return (
      Math.sqrt(2) *
      QuantMetrics.erfInv(2 * Math.max(0.001, Math.min(0.999, p)) - 1)
    );
  }

  private static erfInv(x: number): number {
    const a = 0.147;
    const l = Math.log(1 - x * x);
    const m = 2 / (Math.PI * a) + l / 2;
    const res = Math.sqrt(Math.sqrt(m * m - l / a) - m);
    return x < 0 ? -res : res;
  }

  private static pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i]!;
      const yi = y[i]!;
      sumX += xi;
      sumY += yi;
      sumXY += xi * yi;
      sumX2 += xi * xi;
      sumY2 += yi * yi;
    }

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );
    return den === 0 ? 0 : num / den;
  }

  private static covariance(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n || 0;
    const meanY = y.reduce((a, b) => a + b, 0) / n || 0;
    return (
      x.reduce((acc, v, i) => {
        const yi = y[i];
        return acc + (v - meanX) * ((yi ?? meanY) - meanY);
      }, 0) /
      (n - 1)
    );
  }

  private static variance(x: number[]): number {
    const n = x.length;
    if (n < 2) return 0;
    const mean = x.reduce((a, b) => a + b, 0) / n || 0;
    return x.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  }
  /**
   * Fama-French Five-Factor Model Exposure
   * (Simplified approximation for in-agent validation)
   */
  public static calculateFamaFrench(
    returns: number[],
    market: number[],
    size: number[],
    value: number[],
    profitability: number[],
    investment: number[],
  ) {
    return {
      mkt: QuantMetrics.pearson(returns, market),
      smb: QuantMetrics.pearson(returns, size),
      hml: QuantMetrics.pearson(returns, value),
      rmw: QuantMetrics.pearson(returns, profitability),
      cma: QuantMetrics.pearson(returns, investment),
    };
  }
}
