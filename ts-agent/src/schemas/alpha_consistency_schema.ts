/**
 * Qlib式アルファの整合性と構文を検証するよっ！🛡️✨
 */

export const QLIB_ALLOWED_COLUMNS = new Set([
  "close",
  "open",
  "high",
  "low",
  "volume",
  "vwap",
  "correction_freq",
  "activist_bias",
  "macro_iip",
  "macro_cpi",
  "macro_leverage_trend",
  "segment_sentiment",
  "ai_exposure",
  "kg_centrality",
]);

export const QLIB_ALLOWED_OPS = new Set([
  "Ref",
  "Mean",
  "Std",
  "Corr",
  "Rank",
  "Log",
  "Max",
  "Min",
  "Sum",
  "Abs",
  "CS_ZScore",
]);

export function validateQlibFormula(formula: string): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (!formula || formula.trim().length === 0) {
    return { isValid: false, errorMessage: "[AUDIT] 空の数式だよっ！" };
  }

  // $column 参照の抽出
  const columnRefs = [...formula.matchAll(/\$(\w+)/g)].map((m) => m[1]);
  const unknownCols = columnRefs.filter((c) => !QLIB_ALLOWED_COLUMNS.has(c));
  if (unknownCols.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] 未知のカラムが含まれているよっ！: ${unknownCols.join(", ")}`,
    };
  }

  // Op( 形式の関数呼び出しの抽出
  const ops = [...formula.matchAll(/([A-Z][a-zA-Z_]+)\(/g)].map((m) => m[1]);
  const unknownOps = ops.filter((op) => !QLIB_ALLOWED_OPS.has(op));
  if (unknownOps.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] 未定義の演算子が含まれているよっ！: ${unknownOps.join(", ")}`,
    };
  }

  return { isValid: true };
}
