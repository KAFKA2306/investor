import type React from "react";
import {
  CartesianGrid,
  ScatterChart as RechartsScatterChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

interface ScatterDataPoint {
  symbol: string;
  factor: number;
  return: number;
}

interface ScatterChartProps {
  data: ScatterDataPoint[];
  onClick?: (symbol: string) => void;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({
  data,
  onClick,
}) => {
  return (
    <div className="chart-recharts-wrapper" style={{ height: "360px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--line)"
          />
          <XAxis
            type="number"
            dataKey="factor"
            name="Factor"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
            label={{
              value: "Factor Score",
              position: "insideBottom",
              offset: -10,
              fontSize: 12,
              fill: "var(--ink-soft)",
            }}
          />
          <YAxis
            type="number"
            dataKey="return"
            name="Return"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
            label={{
              value: "Forward Return",
              angle: -90,
              position: "insideLeft",
              fontSize: 12,
              fill: "var(--ink-soft)",
            }}
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <ZAxis type="category" dataKey="symbol" name="Symbol" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "Return")
                return [`${(value * 100).toFixed(2)}%`, name];
              return [value.toFixed(4), name];
            }}
          />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <ReferenceLine x={0} stroke="var(--line-strong)" />
          <Scatter
            name="Stocks"
            data={data}
            fill="var(--brand)"
            fillOpacity={0.6}
            shape="circle"
            onClick={(e: unknown) => {
              const event = e as { symbol: string };
              if (onClick && event?.symbol) {
                onClick(event.symbol);
              }
            }}
            style={{ cursor: onClick ? "pointer" : "default" }}
          />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
