import type React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DrawdownPoint } from "../dashboard_core";

interface DrawdownChartProps {
  data: DrawdownPoint[];
}

export const DrawdownChart: React.FC<DrawdownChartProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    date:
      d.date.length === 8
        ? `${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`
        : d.date,
    drawdown: d.drawdown * 100, // 0 to -100%
  }));

  return (
    <div className="chart-recharts-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--line)"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="var(--danger)"
            fill="var(--chart-dd)"
            name="Drawdown"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
