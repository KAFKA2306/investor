import type React from "react";
import {
  type DerivationSpec,
  formatNullableNumber,
  formatPercentNullable,
  type SourcePath,
  type SourceResolver,
} from "../dashboard_core";

interface MetricCardProps {
  label: string;
  value: number | null | undefined;
  unit?: string;
  sourcePath: SourcePath;
  rootData: unknown;
  resolve: SourceResolver;
  derivation?: DerivationSpec;
  recomputed?: number;
  threshold?: {
    direction: "gt" | "lt";
    value: number;
    label: string;
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = "",
  sourcePath,
  rootData,
  resolve,
  derivation,
  recomputed,
  threshold,
  onClick,
}) => {
  // Resolve value from sourcePath to verify consistency
  const resolvedValue = resolve(rootData, sourcePath);
  const isInternalMismatch =
    value != null &&
    resolvedValue != null &&
    typeof resolvedValue === "number" &&
    Math.abs(value - resolvedValue) > 1e-10;

  const isDiff =
    value != null &&
    recomputed !== undefined &&
    Math.abs(value - recomputed) > 1e-6;
  const diffVal = isDiff ? (recomputed ?? 0) - value : 0;

  const getFormat = (v: number | undefined) => {
    if (unit === "%") return formatPercentNullable(v);
    return formatNullableNumber(v, 4);
  };

  const formattedValue = value == null ? "欠損" : getFormat(value);

  let thresholdStatus = "";
  if (threshold && value != null) {
    if (threshold.direction === "gt") {
      thresholdStatus = value > threshold.value ? "pos" : "neg";
    } else {
      thresholdStatus = value < threshold.value ? "pos" : "neg";
    }
  }

  return (
    <article
      className="metric-card kpi-card"
      style={{ cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className="label"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>{label}</span>
        {threshold && (
          <span style={{ fontSize: "0.65rem", color: "var(--ink-soft)" }}>
            req: {threshold.direction === "gt" ? ">" : "<"} {threshold.value}
          </span>
        )}
      </div>

      <div className={`value ${thresholdStatus}`}>
        {formattedValue}
        {unit !== "%" && unit && (
          <span style={{ fontSize: "0.7em", marginLeft: "2px" }}>{unit}</span>
        )}
      </div>

      <div
        className="metric-source"
        title={
          isInternalMismatch
            ? "INTERNAL ERROR: Source value mismatch"
            : "Data Source Path"
        }
        style={{
          marginTop: "0.3rem",
          fontSize: "0.6rem",
          fontFamily: "var(--mono)",
          color: isInternalMismatch ? "var(--danger)" : "var(--ink-soft)",
          fontWeight: isInternalMismatch ? "bold" : "normal",
        }}
      >
        ↳ {sourcePath} {isInternalMismatch && "⚠ Mismatch!"}
      </div>

      {derivation && (
        <div
          title={`Function: ${derivation.id}\nInputs: ${derivation.inputs.join(", ")}`}
          style={{
            marginTop: "0.1rem",
            fontSize: "0.6rem",
            fontFamily: "var(--mono)",
            color: "var(--ink-soft)",
          }}
        >
          ƒ({derivation.id}) ← {derivation.inputs.join(", ")}
        </div>
      )}

      {recomputed !== undefined && (
        <div
          className={`metric-diff ${isDiff ? "metric-diff-warn" : "metric-diff-ok"}`}
          style={{
            marginTop: "0.5rem",
            padding: "0.3rem",
            fontSize: "0.65rem",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Recomputed: {getFormat(recomputed)}</span>
          <span>
            {isDiff
              ? `⚠ Diff: ${diffVal > 0 ? "+" : ""}${diffVal.toFixed(6)}`
              : "✓ Exact Match"}
          </span>
        </div>
      )}
    </article>
  );
};
