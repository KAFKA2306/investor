import type React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DrawdownChart } from "../components/DrawdownChart";
import { MetricCard } from "../components/MetricCard";
import { RawDataToggle } from "../components/RawDataToggle";
import {
  collectStageMetricRows,
  computeDrawdownSeries,
  recomputeMaxDD,
  recomputeSharpe,
  recomputeTotalReturn,
  resolveSourcePath,
  type StandardVerificationData,
  type UnifiedLogPayload,
} from "../dashboard_core";

interface BacktestAnalysisProps {
  verificationData: StandardVerificationData | null;
  historicalOutcomes: Map<string, UnifiedLogPayload>;
}

export const BacktestAnalysis: React.FC<BacktestAnalysisProps> = ({
  verificationData,
  historicalOutcomes,
}) => {
  if (!verificationData) {
    return <div className="empty">No verification data available.</div>;
  }

  const drawdownPoints = computeDrawdownSeries(
    verificationData.dates,
    verificationData.strategyCum,
  );

  const dailyReturns = verificationData.strategyCum.map((c, i) => ({
    date:
      verificationData.dates[i].length === 8
        ? `${verificationData.dates[i].slice(4, 6)}-${verificationData.dates[i].slice(6, 8)}`
        : verificationData.dates[i],
    return: i === 0 ? 0 : c / (verificationData.strategyCum[i - 1] || 1) - 1,
  }));

  // Historical performance from unified logs (last 30 days of outcomes)
  const historicalSeries = Array.from(historicalOutcomes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, payload]) => {
      const rows = collectStageMetricRows(payload);
      const netReturn = rows.find((r) => r.key === "netReturn")?.value || 0;
      return {
        date: `${date.slice(4, 6)}-${date.slice(6, 8)}`,
        historicalReturn: netReturn * 100, // as percentage
      };
    });

  const combinedChartData = dailyReturns.map((d) => {
    const hist = historicalSeries.find((h) => h.date === d.date);
    return {
      ...d,
      current: d.return * 100,
      historical: hist?.historicalReturn,
    };
  });

  const rawDailyReturnsArray = dailyReturns.map((d) => d.return);

  return (
    <div className="main">
      <div className="section-head">
        <h2>Backtest Analysis</h2>
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">Performance Deep-dive</h1>
          <p className="hero-subtitle">
            Structural analysis of the verified alpha.
          </p>
          <div className="uqtl-grid" style={{ marginTop: "1rem" }}>
            <MetricCard
              label="Total Return"
              value={verificationData.metrics?.totalReturn ?? 0}
              unit="%"
              sourcePath="metrics.totalReturn"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeTotalReturn",
                note: "Cumulative return from baseline",
                inputs: ["strategyCum"],
              }}
              recomputed={recomputeTotalReturn(verificationData.strategyCum)}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={verificationData.metrics?.sharpe ?? 0}
              sourcePath="metrics.sharpe"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeSharpe",
                note: "Annualized Sharpe Ratio",
                inputs: ["strategyCum"],
              }}
              recomputed={recomputeSharpe(rawDailyReturnsArray)}
            />
            <MetricCard
              label="Max DD"
              value={verificationData.metrics?.maxDD ?? 0}
              unit="%"
              sourcePath="metrics.maxDD"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeMaxDD",
                note: "Maximum peak-to-trough decline",
                inputs: ["strategyCum", "dates"],
              }}
              recomputed={recomputeMaxDD(
                verificationData.dates,
                verificationData.strategyCum,
              )}
            />
          </div>
        </div>
      </div>

      <div className="panel section">
        <h3 className="quick-title">Current vs Historical Production (%)</h3>
        <div className="chart-recharts-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--line)"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="Current Backtest"
                stroke="var(--brand)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="historical"
                name="Historical Production"
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel section">
        <h3 className="quick-title">Structural Drawdown</h3>
        <DrawdownChart data={drawdownPoints} />
      </div>

      <div className="panel section">
        <h3 className="quick-title">Technical Glossary</h3>
        <div className="main" style={{ marginTop: "1rem", gap: "1rem" }}>
          <div>
            <strong>Sharpe Ratio</strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.2rem 0",
              }}
            >
              The excess return per unit of risk (standard deviation). A value
              above 1.5 is considered excellent for quantitative strategies.
            </p>
          </div>
          <div>
            <strong>Information Coefficient (IC)</strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.2rem 0",
              }}
            >
              The correlation between predicted alpha and actual forward
              returns. This measures the predictive power of the factor.
            </p>
          </div>
          <div>
            <strong>Max Drawdown (MaxDD)</strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.2rem 0",
              }}
            >
              The maximum peak-to-trough decline of the cumulative return curve.
              Critical for risk management.
            </p>
          </div>
        </div>
      </div>

      <RawDataToggle
        data={verificationData}
        fileName="backtest_analysis.json"
      />
    </div>
  );
};
