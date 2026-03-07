import type React from "react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricCard } from "../components/MetricCard";
import type { StandardVerificationData } from "../dashboard_core";

// Shared chart styles
const CHART_STYLES = {
  grid: { strokeDasharray: "3 3" as const, stroke: "var(--border)" },
  axis: { stroke: "var(--fg-secondary)", fontSize: "0.85rem" as const },
  tooltip: {
    background: "var(--bg-panel)",
    border: "1px solid var(--border)",
    color: "var(--fg)",
  },
} as const;

interface StockAnalysisProps {
  verificationData: StandardVerificationData | null;
}

export const StockAnalysis: React.FC<StockAnalysisProps> = ({
  verificationData,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const symbols = useMemo(
    () =>
      verificationData?.individualData
        ? Object.keys(verificationData.individualData).sort()
        : [],
    [verificationData],
  );

  const activeSymbol = selectedSymbol || symbols[0];
  const stockData = verificationData?.individualData?.[activeSymbol];

  // Prepare chart data combining price, factors, and positions
  const chartData = useMemo(
    () =>
      stockData?.dates.map((date, i) => ({
        date:
          date.length === 8 ? `${date.slice(4, 6)}-${date.slice(6, 8)}` : date,
        price: stockData.prices[i],
        factor: stockData.factors[i],
        position: stockData.positions[i],
      })) ?? [],
    [stockData],
  );

  // Calculate key statistics
  const { priceReturn, avgFactor, avgPosition, maxPosition } = useMemo(() => {
    if (!stockData) {
      return { priceReturn: 0, avgFactor: 0, avgPosition: 0, maxPosition: 0 };
    }
    const pr =
      stockData.prices.length > 1
        ? ((stockData.prices[stockData.prices.length - 1] -
            stockData.prices[0]) /
            stockData.prices[0]) *
          100
        : 0;

    const af =
      stockData.factors.reduce((a, b) => a + b, 0) / stockData.factors.length;
    const ap =
      stockData.positions.reduce((a, b) => a + b, 0) /
      stockData.positions.length;
    const mp = Math.max(...stockData.positions);

    return { priceReturn: pr, avgFactor: af, avgPosition: ap, maxPosition: mp };
  }, [stockData]);

  if (!verificationData?.individualData) {
    return <div className="empty">個別銘柄データが利用できません。</div>;
  }

  if (!stockData) {
    return <div className="empty">銘柄データが見つかりません。</div>;
  }

  return (
    <div className="main">
      <div className="section-head">
        <h2>銘柄別分析 📈💼</h2>
      </div>

      {/* Stock Selector */}
      <div className="panel section">
        <h3 className="quick-title">📍 銘柄選択</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: "0.5rem",
            marginTop: "1rem",
          }}
        >
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => setSelectedSymbol(symbol)}
              style={{
                padding: "0.75rem 1rem",
                border:
                  activeSymbol === symbol
                    ? "2px solid var(--brand)"
                    : "1px solid var(--border)",
                background:
                  activeSymbol === symbol
                    ? "var(--bg-hover)"
                    : "var(--bg-panel)",
                color: "var(--fg)",
                cursor: "pointer",
                borderRadius: "6px",
                fontWeight: activeSymbol === symbol ? "600" : "400",
                transition: "all 0.2s",
              }}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">{activeSymbol} パフォーマンス</h1>
          <p className="hero-subtitle">
            {stockData.dates[0]} ～{" "}
            {stockData.dates[stockData.dates.length - 1]}
          </p>
          <div className="uqtl-grid" style={{ marginTop: "1rem" }}>
            <MetricCard label="価格リターン" value={priceReturn} unit="%" />
            <MetricCard
              label="平均ファクタースコア"
              value={avgFactor}
              unit=""
            />
            <MetricCard label="平均ポジション" value={avgPosition} unit="" />
            <MetricCard label="最大ポジション" value={maxPosition} unit="" />
          </div>
        </div>
      </div>

      {/* Price vs Factor Score Chart */}
      <div className="panel section">
        <h3 className="quick-title">💹 価格 & ファクタースコア推移</h3>
        <div style={{ width: "100%", height: "400px", marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid {...CHART_STYLES.grid} />
              <XAxis dataKey="date" {...CHART_STYLES.axis} />
              <YAxis
                yAxisId="left"
                {...CHART_STYLES.axis}
                label={{ value: "価格", angle: -90, position: "insideLeft" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                {...CHART_STYLES.axis}
                label={{
                  value: "ファクタースコア",
                  angle: 90,
                  position: "insideRight",
                }}
              />
              <Tooltip contentStyle={CHART_STYLES.tooltip} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="price"
                stroke="var(--brand)"
                dot={false}
                name="価格"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="factor"
                stroke="var(--accent)"
                dot={false}
                name="ファクタースコア"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Position Over Time */}
      <div className="panel section">
        <h3 className="quick-title">📊 ポジション推移</h3>
        <div style={{ width: "100%", height: "300px", marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid {...CHART_STYLES.grid} />
              <XAxis dataKey="date" {...CHART_STYLES.axis} />
              <YAxis {...CHART_STYLES.axis} />
              <Tooltip contentStyle={CHART_STYLES.tooltip} />
              <Line
                type="monotone"
                dataKey="position"
                stroke="var(--success)"
                dot={false}
                name="ポジション"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="panel section">
        <h3 className="quick-title">📋 詳細データ</h3>
        <div
          style={{
            overflowX: "auto",
            marginTop: "1rem",
            maxHeight: "500px",
            overflowY: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "var(--bg-hover)" }}>
                <th
                  style={{
                    padding: "0.75rem",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  日付
                </th>
                <th
                  style={{
                    padding: "0.75rem",
                    textAlign: "right",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  価格
                </th>
                <th
                  style={{
                    padding: "0.75rem",
                    textAlign: "right",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  ファクタースコア
                </th>
                <th
                  style={{
                    padding: "0.75rem",
                    textAlign: "right",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  ポジション
                </th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => (
                <tr
                  key={`${activeSymbol}-${row.date}`}
                  style={{
                    backgroundColor:
                      i % 2 === 0 ? "transparent" : "var(--bg-hover)",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {row.date}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {row.price.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {row.factor.toFixed(4)}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "right",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {row.position.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
