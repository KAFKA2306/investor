/**
 * 指定した時間だけ、可愛くお昼寝するよっ！💤✨
 * @param ms ミリ秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * システムが疲れすぎないように、スロットリング（流量制限）するよっ！🛡️✨
 */
export async function throttle<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  delayMs = 100,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const chunk = tasks.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((t) => t()));
    results.push(...chunkResults);
    if (i + limit < tasks.length) {
      await sleep(delayMs);
    }
  }
  return results;
}

/**
 * 時間の守護者、rateLimiterだよっ！💖✨
 */
export const rateLimiter = {
  sleep,
  throttle,
};
