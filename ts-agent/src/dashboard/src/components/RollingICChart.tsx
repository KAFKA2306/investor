import type React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RollingICPoint } from "../dashboard_core";

interface RollingICChartProps {
  data: RollingICPoint[];
}

export const RollingICChart: React.FC<RollingICChartProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    date:
      d.date.length === 8
        ? `${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`
        : d.date,
    ic: d.ic,
    proxy: d.proxy,
  }));

  const hasProxy = chartData.some((d) => d.proxy.kind !== "none");

  return (
    <div className="chart-recharts-wrapper" style={{ position: "relative" }}>
      {hasProxy && <div className="proxy-watermark">PROXY</div>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
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
            domain={[-0.2, 0.2]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string, props: any) => {
              const valStr = value.toFixed(4);
              const proxy = props.payload.proxy;
              if (proxy && proxy.kind !== "none") {
                return [`${valStr} (PROXY: ${proxy.note})`, name];
              }
              return [valStr, name];
            }}
          />
          <ReferenceLine
            y={0.04}
            stroke="var(--brand)"
            strokeDasharray="3 3"
            label={{
              position: "right",
              value: "0.04",
              fontSize: 10,
              fill: "var(--brand)",
            }}
          />
          <ReferenceLine
            y={-0.04}
            stroke="var(--danger)"
            strokeDasharray="3 3"
            label={{
              position: "right",
              value: "-0.04",
              fontSize: 10,
              fill: "var(--danger)",
            }}
          />
          <Bar dataKey="ic" radius={[2, 2, 0, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.date}
                fill={
                  entry.ic !== null && entry.ic >= 0
                    ? "var(--chart-ic-pos)"
                    : "var(--chart-ic-neg)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
