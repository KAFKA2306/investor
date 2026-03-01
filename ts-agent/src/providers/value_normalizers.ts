import { existsSync, readFileSync } from "node:fs";
import { mathUtils } from "../utils/math_utils.ts";

// ── シンボル・日付ユーティリティ ────────────────────────────────────────────────
export function toSymbol4(value: string): string {
  return value.replace(".T", "").trim().slice(0, 4);
}

export function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export const toFiniteNumber = (value: unknown, defaultValue = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

/**
 * オブジェクトから複数のキー候補を使って数値を取り出すよっ！✨
 */
export const getNumberByKeys = (
  row: Record<string, unknown>,
  keys: readonly string[],
): number => {
  const val = keys.map((k) => row[k]).find((v) => v !== undefined);
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

// ── IntelligenceMap ──────────────────────────────────────────────────────────
export type IntelligencePoint = {
  sentiment: number;
  aiExposure: number;
  kgCentrality: number;
  correctionFlag: number;
  correctionCount90d: number;
};

export type IntelligenceMap = Record<string, Record<string, IntelligencePoint>>;

/**
 * edinet_10k_intelligence_map.json を読み込んでパースするよ。
 * ファイルが存在しない場合は空のマップを返すよっ。🧠✨
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

// ── NormalizedBar ────────────────────────────────────────────────────────────
export type NormalizedBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * マーケットデータの生行をNormalizedBarに変換して日付順にソートするよ。
 * open/close が 0 以下の行は除外するよっ。
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
