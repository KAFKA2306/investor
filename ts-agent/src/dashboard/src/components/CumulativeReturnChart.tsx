import type React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CumulativeReturnChartProps {
  dates: string[];
  strategyCum: number[];
  benchmarkCum: number[];
}

export const CumulativeReturnChart: React.FC<CumulativeReturnChartProps> = ({
  dates,
  strategyCum,
  benchmarkCum,
}) => {
  const data = dates.map((date, i) => ({
    date: date.length === 8 ? `${date.slice(4, 6)}-${date.slice(6, 8)}` : date,
    strategy: (strategyCum[i] - 1) * 100, // 1.0 -> 0%
    benchmark: (benchmarkCum[i] - 1) * 100,
  }));

  return (
    <div className="chart-recharts-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
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
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
          />
          <Line
            type="monotone"
            dataKey="strategy"
            stroke="var(--chart-strategy)"
            strokeWidth={2.5}
            dot={false}
            name="Strategy"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="var(--chart-benchmark)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
