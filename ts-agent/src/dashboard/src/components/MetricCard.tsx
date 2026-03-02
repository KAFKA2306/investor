import type React from "react";

/**
 * KPIを圧倒的にプロフェッショナルかつプレミアムに表示するカードだよっ！💎✨
 * 投資家が信頼を寄せる「重厚感」のあるデザインを目指したんだもんっ！🌈
 */
export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string | number;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subValue,
  trend,
  icon,
  onClick,
}) => {
  const trendClass = trend === "up" ? "pos" : trend === "down" ? "neg" : "";

  return (
    <button
      type="button"
      className={`panel kpi-card ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        width: "100%",
        display: "block",
        textAlign: "left",
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
      }}
    >
      <div className="section-head">
        <h3>{label}</h3>
        {icon && <span className="icon-host">{icon}</span>}
      </div>
      <div className="kpi-main">
        <span className="kpi-value">
          {typeof value === "number"
            ? value.toLocaleString(undefined, { maximumFractionDigits: 3 })
            : value}
        </span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {subValue !== undefined && (
        <div className={`kpi-sub ${trendClass}`}>
          {trend === "up" && "▲"}
          {trend === "down" && "▼"}
          <span>比較: {subValue}</span>
        </div>
      )}
    </button>
  );
};
