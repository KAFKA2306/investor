// Compatibility surface for the still-supported EDINET CLI scripts.
// Keep this module intentionally narrow: the broader normalization utilities were
// removed in March 2026 and must not be resurrected through this entrypoint.

export function toSymbol4(value: string): string {
  return value.replace(".T", "").trim().slice(0, 4);
}

export function toIsoDate(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}
