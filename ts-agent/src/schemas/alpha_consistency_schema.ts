export const QLIB_ALLOWED_COLUMNS = new Set([
  "close", "open", "high", "low", "volume",
  "correction_freq", "activist_bias",
  "macro_iip", "macro_cpi", "macro_leverage_trend",
  "segment_sentiment", "ai_exposure", "kg_centrality",
]);

export const QLIB_ALLOWED_OPS = new Set([
  "Ref", "Mean", "Std", "Corr", "Rank", "Log",
  "Max", "Min", "Sum", "Abs",
]);

export function validateQlibFormula(formula: string): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (!formula || formula.trim().length === 0) {
    return { isValid: false, errorMessage: "[AUDIT] Empty formula" };
  }

  const columnRefs = [...formula.matchAll(/\$(\w+)/g)].map(m => m[1]);
  const unknownCols = columnRefs.filter(c => !QLIB_ALLOWED_COLUMNS.has(c));
  if (unknownCols.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] Unknown columns in formula: ${unknownCols.join(", ")}`,
    };
  }

  const ops = [...formula.matchAll(/([A-Z][a-zA-Z]+)\(/g)].map(m => m[1]);
  const unknownOps = ops.filter(op => !QLIB_ALLOWED_OPS.has(op));
  if (unknownOps.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] Unknown operators in formula: ${unknownOps.join(", ")}`,
    };
  }

  return { isValid: true };
}
