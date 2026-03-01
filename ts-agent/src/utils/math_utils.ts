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
export function zScore(values: number[]): number[] {
  const avg = mean(values);
  const std = stdDev(values);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - avg) / std);
}

/**
 * 相関係数（Correlation）を計算するよっ！🤝
 */
export function calculateCorr(x: number[], y: number[]): number {
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
 * 数字の「きゅーとな相棒」mathUtilsだよっ！🔢💖
 */
export const mathUtils = {
  clamp,
  clamp01,
  mean,
  stdDev,
  zScore,
  calculateCorr,
  pickOne,
  randomInt,
};
