/**
 * ✨ プロジェクト共通の数学・統計ユーティリティ ✨
 */

/**
 * 数値を指定した範囲内に収めるよっ！🛡️
 */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 0.0 から 1.0 の間にぴたっと収めるよっ！🎀
 */
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/**
 * 配列の平均（Mean）を計算するよっ！📊
 */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * 配列の標準偏差（Standard Deviation）を計算するよっ！📉
 */
export function stdDev(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => (v - avg) ** 2);
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Z-Score（標準化スコア）を計算して、平均 0、分散 1 にするよっ！✨
 */
export function zScore(values: readonly number[]): number[] {
  const avg = mean(values);
  const std = stdDev(values);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - avg) / std);
}

/**
 * 相関係数（Correlation）を計算するよっ！🤝
 */
export function calculateCorr(
  x: readonly number[],
  y: readonly number[],
): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const xMean = mean(x);
  const yMean = mean(y);
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i]! - xMean;
    const dy = y[i]! - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

/**
 * 最大ドローダウン（Max Drawdown）を計算するよっ！📉
 */
export function computeMaxDrawdown(returns: readonly number[]): number {
  let peak = 1;
  let equity = 1;
  let maxDD = 0;
  for (const r of returns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, (equity - peak) / peak);
  }
  return maxDD;
}

/**
 * t-統計量（t-Statistic）を計算するよっ！📊
 */
export function calculateTStat(r: readonly number[]): number {
  const n = r.length;
  if (n < 2) return 0;
  const mu = mean(r);
  const sigma = stdDev(r);
  return sigma === 0 ? 0 : mu / (sigma / Math.sqrt(n));
}

/**
 * p-値（p-Value）を計算するよっ！🔍
 */
export function calculatePValue(t: number, n: number): number {
  if (n < 2) return 1.0;
  const x = Math.abs(t);
  const k = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    k *
    (0.3193815 +
      k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274))));
  const p = x > 0 ? 1 - prob : prob;
  return 2 * (1 - p);
}

/**
 * シャープレシオ（Sharpe Ratio）を計算するよっ！🏆
 */
export function calculateSharpeRatio(
  returns: readonly number[],
  rfr = 0,
  annualizeFactor = 252,
): number {
  if (returns.length < 2) return 0;
  const mu = mean(returns);
  const sigma = stdDev(returns);
  return sigma === 0 ? 0 : ((mu - rfr) / sigma) * Math.sqrt(annualizeFactor);
}

/**
 * 年率リターン（Annualized Return）を計算するよっ！📈
 */
export function calculateAnnualizedReturn(
  netReturn: number,
  days: number,
  annualizeFactor = 252,
): number {
  return days <= 0 ? 0 : (1 + netReturn) ** (annualizeFactor / days) - 1;
}

/**
 * 配列からランダムに一つ選ぶよっ！🎯
 */
export function pickOne<T>(items: readonly T[]): T {
  const value = items[Math.floor(Math.random() * items.length)];
  if (value === undefined) {
    throw new Error("random selection failed: array is empty");
  }
  return value;
}

/**
 * 指定した範囲の整数の乱数を生成するよっ！🎲
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * RMSE（平方根平均二乗誤差）を計算するよっ！📉
 */
export function calculateRMSE(
  a: readonly number[],
  p: readonly number[],
): number {
  const n = Math.min(a.length, p.length);
  if (n === 0) return 0;
  const mse = a.reduce((acc, val, i) => acc + (val - p[i]!) ** 2, 0) / n;
  return Math.sqrt(mse);
}

/**
 * SMAPE（対称平均絶対パーセント誤差）を計算するよっ！📊
 */
export function calculateSMAPE(
  a: readonly number[],
  p: readonly number[],
): number {
  const n = Math.min(a.length, p.length);
  if (n === 0) return 0;
  const sum = a.reduce((acc, val, i) => {
    const den = (Math.abs(val) + Math.abs(p[i]!)) / 2;
    return acc + (den !== 0 ? Math.abs(p[i]! - val) / den : 0);
  }, 0);
  return (sum / n) * 100;
}

/**
 * DA（方向正確性）を計算するよっ！🎯
 */
export function calculateDA(
  a: readonly number[],
  p: readonly number[],
  prev: readonly number[],
): number {
  const n = Math.min(a.length, p.length, prev.length);
  if (n === 0) return 0;
  let correct = 0;
  for (let i = 0; i < n; i++) {
    if (Math.sign(a[i]! - prev[i]!) === Math.sign(p[i]! - prev[i]!)) {
      correct++;
    }
  }
  return (correct / n) * 100;
}

/**
 * GaussRank スケーリングのための逆誤差関数だよっ！📉
 */
function erfInv(x: number): number {
  const a = 0.147;
  const l = Math.log(1 - x * x);
  const m = 2 / (Math.PI * a) + l / 2;
  const res = Math.sqrt(Math.sqrt(m * m - l / a) - m);
  return x < 0 ? -res : res;
}

/**
 * 標準正規分布の累積分布関数の逆関数（逆CDF）だよっ！🎀
 */
export function invNormalCdf(p: number): number {
  return Math.sqrt(2) * erfInv(2 * Math.max(0.001, Math.min(0.999, p)) - 1);
}

/**
 * データを正規分布にマッピングする GaussRank スケーリングだよっ！✨
 */
export function gaussRank(data: readonly number[]): number[] {
  const sorted = [...data].sort((a, b) => a - b);
  return data.map((v) => invNormalCdf(sorted.indexOf(v) / (data.length - 1)));
}

/**
 * 逆正規累積分布関数を使って、より高度な分散分析をするよっ！🛡️
 */
export function calculateGaussCorr(
  p: readonly number[],
  t: readonly number[],
): number {
  if (p.length < 2 || t.length < 2) return 0;
  return calculateCorr(gaussRank([...p]), gaussRank([...t]));
}

/**
 * インフォメーション・レシオ（Information Ratio）を計算するよっ！📊
 */
export function calculateInformationRatio(
  strategyReturns: readonly number[],
  benchmarkReturns: readonly number[],
  annualizeFactor = 252,
): number {
  if (
    strategyReturns.length !== benchmarkReturns.length ||
    strategyReturns.length < 2
  )
    return 0;
  const activeReturns = strategyReturns.map((r, i) => r - benchmarkReturns[i]!);
  const avgActiveReturn = mean(activeReturns);
  const trackingError = stdDev(activeReturns);
  return trackingError === 0
    ? 0
    : (avgActiveReturn / trackingError) * Math.sqrt(annualizeFactor);
}

/**
 * ソルティノレシオ（Sortino Ratio）を計算するよっ！🛡️
 */
export function calculateSortinoRatio(
  returns: readonly number[],
  rfr = 0,
  annualizeFactor = 252,
): number {
  if (returns.length < 2) return 0;
  const mu = mean(returns);
  const downsideReturns = returns
    .filter((r) => r < rfr)
    .map((r) => (r - rfr) ** 2);
  const downsideDev = Math.sqrt(mean(downsideReturns));
  return downsideDev === 0
    ? 0
    : ((mu - rfr) / downsideDev) * Math.sqrt(annualizeFactor);
}

/**
 * OHLCデータを上位の時間軸にリサンプリングするよっ！⏰✨
 */
export function resampleOHLC<
  T extends {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  },
>(bars: readonly T[], windowSize: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < bars.length; i += windowSize) {
    const chunk = bars.slice(i, i + windowSize);
    if (chunk.length === 0) continue;

    const resampled = {
      ...chunk[0]!,
      high: Math.max(...chunk.map((b) => b.high)),
      low: Math.min(...chunk.map((b) => b.low)),
      close: chunk[chunk.length - 1]!.close,
      volume: chunk.reduce((sum, b) => sum + b.volume, 0),
    };
    result.push(resampled);
  }
  return result;
}

/**
 * 数字の「きゅーとな相棒」mathUtilsだよっ！🔢💖
 */
export const mathUtils = {
  clamp,
  clamp01,
  mean,
  stdDev,
  zScore,
  calculateCorr,
  calculateGaussCorr,
  computeMaxDrawdown,
  calculateTStat,
  calculatePValue,
  calculateSharpeRatio,
  calculateInformationRatio,
  calculateSortinoRatio,
  calculateAnnualizedReturn,
  calculateRMSE,
  calculateSMAPE,
  calculateDA,
  gaussRank,
  invNormalCdf,
  pickOne,
  randomInt,
  resampleOHLC,
};
