/**
 * 数値を可愛くカンマ区切りにするよっ！🔢✨
 */
export function formatNumber(v: number): string {
  return v.toLocaleString();
}

/**
 * パーセンテージを綺麗に見せるよっ！📈✨
 */
export function formatPercent(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

/**
 * 通（JPY）をかっこよく表示するよっ！💴✨
 */
export function formatCurrency(v: number): string {
  return `${formatNumber(Math.round(v))}円`;
}

/**
 * 日付（YYYYMMDDなど）を可愛くハイフン区切りにするよっ！📅✨
 */
export function formatDate(d: string): string {
  const clean = d.replaceAll("-", "");
  if (clean.length !== 8) return d;
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

/**
 * フォーマットの魔法使い、valueFormattersだよっ！🌈✨
 */
export const valueFormatters = {
  number: formatNumber,
  percent: formatPercent,
  currency: formatCurrency,
  date: formatDate,
};
