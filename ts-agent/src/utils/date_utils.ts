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
 * YYYYMMDD 形式の文字列を取得するよっ！📅
 */
export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * ファイル名に使えるタイムスタンプを作るよっ！📁
 */
export function fileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
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
 * 日付操作の「きゅーとな相棒」dateUtilsだよっ！📅💖
 */
export const dateUtils = {
  nowIso,
  todayYmd,
  fileTimestamp,
  sleep,
  startTimer,
};
