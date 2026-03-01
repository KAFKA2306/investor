import { existsSync, readFileSync } from "node:fs";
import { mathUtils } from "./math_utils.ts";

// ── 正規化 (Normalizers) ───────────────────────────────────────────────────

/**
 * 証券コードを4桁に整えるよっ！🔢✨
 */
export function toSymbol4(value: string): string {
  return value.replace(".T", "").trim().slice(0, 4);
}

/**
 * 日付をISO形式（YYYY-MM-DD）に正規化するよっ！📅✨
 * 形式が合わない場合は null を返すよ。
 */
export function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const clean = v.replaceAll("-", "");
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * 有限な数値に変換するよっ！🔢✨
 */
export function toFiniteNumber(value: unknown, defaultValue = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
}

/**
 * オブジェクトから複数のキー候補を使って数値を取り出すよっ！✨
 */
export function getNumberByKeys(
  row: Record<string, unknown>,
  keys: readonly string[],
): number {
  const val = keys.map((k) => row[k]).find((v) => v !== undefined);
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

// ── フォーマット (Formatters) ────────────────────────────────────────────────

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
 * 通貨（JPY）をかっこよく表示するよっ！💴✨
 */
export function formatCurrency(v: number): string {
  return `${formatNumber(Math.round(v))}円`;
}

/**
 * 日付を表示用にフォーマットするよっ！📅✨
 */
export function formatDate(d: string): string {
  return toIsoDate(d) ?? d;
}

// ── ドメイン固有 (Domain Specific) ──────────────────────────────────────────

export type IntelligencePoint = {
  sentiment: number;
  aiExposure: number;
  kgCentrality: number;
  correctionFlag: number;
  correctionCount90d: number;
};

export type IntelligenceMap = Record<string, Record<string, IntelligencePoint>>;

/**
 * インテリジェンスマップを読み込んでパースするよっ！🧠✨
 */
export function parseIntelligenceMap(filePath: string): IntelligenceMap {
  if (!existsSync(filePath)) return {};
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<
    string,
    Record<string, Partial<IntelligencePoint>>
  >;
  const result: IntelligenceMap = {};
  for (const [symbolRaw, datedValues] of Object.entries(raw)) {
    const symbol = toSymbol4(symbolRaw);
    if (!/^\d{4}$/.test(symbol)) continue;
    for (const [dateRaw, point] of Object.entries(datedValues ?? {})) {
      const isoDate = toIsoDate(dateRaw) ?? dateRaw;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
      if (!result[symbol]) result[symbol] = {};
      result[symbol][isoDate] = {
        sentiment: mathUtils.clamp(toFiniteNumber(point.sentiment, 0.5), 0, 1),
        aiExposure: Math.max(0, toFiniteNumber(point.aiExposure, 0)),
        kgCentrality: Math.max(0, toFiniteNumber(point.kgCentrality, 0)),
        correctionFlag: mathUtils.clamp(
          Math.floor(toFiniteNumber(point.correctionFlag, 0)),
          0,
          1,
        ),
        correctionCount90d: Math.max(
          0,
          Math.floor(toFiniteNumber(point.correctionCount90d, 0)),
        ),
      };
    }
  }
  return result;
}

export type NormalizedBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * マーケットデータを正規化するよっ！📈✨
 */
export function normalizeBars(
  rows: readonly Record<string, unknown>[],
): NormalizedBar[] {
  return rows
    .map((row) => {
      const dateRaw = String(row.Date ?? row.date ?? "");
      const date = toIsoDate(dateRaw);
      if (!date) return null;
      const open = toFiniteNumber(row.Open ?? row.open, 0);
      const high = toFiniteNumber(row.High ?? row.high, 0);
      const low = toFiniteNumber(row.Low ?? row.low, 0);
      const close = toFiniteNumber(row.Close ?? row.close, 0);
      const volume = Math.max(0, toFiniteNumber(row.Volume ?? row.volume, 0));
      if (open <= 0 || close <= 0) return null;
      return {
        date,
        open,
        high: high > 0 ? high : close,
        low: low > 0 ? low : close,
        close,
        volume,
      };
    })
    .filter((row): row is NormalizedBar => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── 公開オブジェクト (Public Objects) ────────────────────────────────────────

export const valueNormalizers = {
  toSymbol4,
  toIsoDate,
  toFiniteNumber,
  getNumberByKeys,
  parseIntelligenceMap,
  normalizeBars,
};

export const valueFormatters = {
  number: formatNumber,
  percent: formatPercent,
  currency: formatCurrency,
  date: formatDate,
};

export const valueUtils = {
  normalizers: valueNormalizers,
  formatters: valueFormatters,
  ...valueNormalizers,
  ...valueFormatters,
};
