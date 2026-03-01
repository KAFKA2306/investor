export function toSymbol4(value: string): string {
  return value.replace(".T", "").trim().slice(0, 4);
}

export function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return v;
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function std(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
}
