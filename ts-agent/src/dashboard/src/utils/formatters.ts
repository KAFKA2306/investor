export const pickNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

export const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

export const canonicalDate = (value: string | undefined): string => {
  if (!value) return "";
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : "";
};

export const formatDate = (value: string): string => {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

export const formatPercent = (value: number, digits = 2): string =>
  `${(value * 100).toFixed(digits)}%`;

export const formatSignedPercent = (value: number, digits = 2): string => {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value, digits)}`;
};

export const formatBps = (value: number): string => `${value.toFixed(1)} bps`;

export const formatCompact = (value: number): string =>
  new Intl.NumberFormat("ja-JP", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export const shortId = (value: string, width = 8): string =>
  value.length <= width ? value : `${value.slice(0, width)}…`;

export const chipClass = (status: string): string => {
  const normalized = (status || "").toUpperCase();
  if (
    normalized.includes("PASS") ||
    normalized.includes("READY") ||
    normalized.includes("USEFUL") ||
    normalized.includes("APPROVE") ||
    normalized.includes("LONG") ||
    normalized.includes("維持") ||
    normalized.includes("許容")
  ) {
    return "ready";
  }
  if (
    normalized.includes("CAUTION") ||
    normalized.includes("WATCH") ||
    normalized.includes("中立") ||
    normalized.includes("様子見")
  ) {
    return "caution";
  }
  if (
    normalized.includes("FAIL") ||
    normalized.includes("ERROR") ||
    normalized.includes("SHORT") ||
    normalized.includes("防御") ||
    normalized.includes("縮小")
  ) {
    return "risk";
  }
  return "neutral";
};
