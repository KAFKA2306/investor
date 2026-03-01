/**
 * ✨ プロジェクト共通の配列操作ユーティリティ ✨
 */

/**
 * 配列をランダムに入れ替えるよっ！🔀
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * 重複を削除してユニークな配列にするよっ！🛡️
 */
export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * 配列を指定したサイズごとに分割するよっ！🍕
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * 配列の最後から n 個取得するよっ！🐾
 */
export function last<T>(items: readonly T[], n = 1): T[] {
  return items.slice(-n);
}

/**
 * 条件に合う要素をカウントするよっ！🔢
 */
export function countBy<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): number {
  return items.reduce((acc, item) => (predicate(item) ? acc + 1 : acc), 0);
}

/**
 * 配列操作の「きゅーとな相棒」arrayUtilsだよっ！📦💖
 */
export const arrayUtils = {
  shuffle,
  unique,
  chunk,
  last,
  countBy,
};
