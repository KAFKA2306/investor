/**
 * ✨ プロジェクト共通の日付・タイムスタンプユーティリティ ✨
 */

/**
 * 現在の時刻を ISO 形式 (UTC) で取得するよっ！⏰
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 現在の時刻を YYYYMMDD 形式で取得するよっ！📅
 */
export function nowYmd(): string {
  return todayYmd();
}

/**
 * 日付を ISO 形式に可愛く整えるよっ！✨
 */
export function formatDateISO(date: Date | string | number): string {
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
}

/**
 * 指定した秒数だけ待機するよっ！💤
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 経過時間をミリ秒で計測するためのヘルパーだよっ！⏱️
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

/**
 * 今日の日付を YYYYMMDD 形式で取得するよっ！📅✨
 */
export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * ファイル名に使えるタイムスタンプを取得するよっ！📁✨
 */
export function fileTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .split("Z")[0]!;
}

/**
 * 日付操作の「きゅーとな相棒」dateUtilsだよっ！📅💖
 */
export const dateUtils = {
  nowIso,
  nowYmd,
  todayYmd,
  formatDateISO,
  fileTimestamp,
  sleep,
  startTimer,
};
