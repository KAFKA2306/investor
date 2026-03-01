import type React from "react";

/**
 * KPIを可愛く、プレミアムに表示するカードだよっ！🎀✨
 */
export interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string | number;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  icon,
}) => {
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-rose-400"
        : "text-slate-400";

  return (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl hover:shadow-cyan-500/10 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
          {title}
        </h3>
        {icon && (
          <div className="text-cyan-400 bg-cyan-400/10 p-2 rounded-lg">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white tracking-tight">
          {value}
        </span>
        {subValue && (
          <span className={`text-sm font-semibold ${trendColor}`}>
            {trend === "up" && "▲"}
            {trend === "down" && "▼"}
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
};
