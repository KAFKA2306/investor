import type React from "react";
import { useMemo } from "react";
import type {
  DailyLogEnvelope,
  DailyReport,
  StandardVerificationData,
  UnifiedLogPayload,
} from "../dashboard_core";
import {
  chipClass,
  collectStageMetricRows,
  formatBpsNullable,
  formatDate,
  formatNullableNumber,
  formatPercentNullable,
  formatSignedPercentNullable,
  pickNumber,
  readStageMetric,
} from "../dashboard_core";

interface FinancialMetricsViewProps {
  report: DailyReport | null;
  benchmark: UnifiedLogPayload | null;
  outcome: UnifiedLogPayload | null;
  dailyByDate: Map<string, DailyLogEnvelope>;
  timeline: string[];
  verificationData?: StandardVerificationData | null;
}

type TrendPoint = {
  date: string;
  netReturn: number | undefined;
  basketDailyReturn: number | undefined;
};

const CHART_WIDTH = 700;
const CHART_HEIGHT = 170;
const CHART_PADDING = 14;

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const FinancialMetricsView: React.FC<FinancialMetricsViewProps> = ({
  report,
  benchmark,
  outcome,
  dailyByDate,
  timeline,
  verificationData,
}) => {
  const backtest = report?.results?.backtest;
  const stageRows = useMemo(() => {
    const benchmarkRows = collectStageMetricRows(benchmark).map((row) => ({
      ...row,
      source: "benchmark",
    }));
    const outcomeRows = collectStageMetricRows(outcome).map((row) => ({
      ...row,
      source: "investment_outcome",
    }));
    return [...benchmarkRows, ...outcomeRows].sort((a, b) => {
      if (a.source !== b.source) return a.source.localeCompare(b.source);
      if (a.stage !== b.stage) return a.stage.localeCompare(b.stage);
      return a.key.localeCompare(b.key);
    });
  }, [benchmark, outcome]);

  const sharpeRatio =
    pickNumber(backtest?.sharpe) ??
    readStageMetric(benchmark, ["sharpe", "sharpeRatio"]) ??
    readStageMetric(outcome, ["sharpe", "sharpeRatio"]) ??
    verificationData?.metrics?.sharpe;
  const maxDrawdown =
    pickNumber(backtest?.maxDrawdown) ??
    readStageMetric(benchmark, ["mdd", "maxDrawdown", "maxDD", "drawdown"]) ??
    readStageMetric(outcome, ["mdd", "maxDrawdown", "maxDD", "drawdown"]) ??
    (verificationData?.metrics?.maxDD
      ? verificationData.metrics.maxDD / 100
      : undefined);
  const volatility =
    readStageMetric(benchmark, ["volatility", "vol"]) ??
    readStageMetric(outcome, ["volatility", "vol"]);
  const cagr =
    readStageMetric(benchmark, ["cagr"]) ?? readStageMetric(outcome, ["cagr"]);
  const winRate =
    readStageMetric(benchmark, ["winRate"]) ??
    readStageMetric(outcome, ["winRate"]);
  const profitFactor =
    readStageMetric(benchmark, ["profitFactor"]) ??
    readStageMetric(outcome, ["profitFactor"]);
  const informationRatio =
    readStageMetric(benchmark, ["informationRatio"]) ??
    readStageMetric(outcome, ["informationRatio"]);
  const informationCoefficient =
    readStageMetric(benchmark, ["informationCoefficient", "ic"]) ??
    readStageMetric(outcome, ["informationCoefficient", "ic"]) ??
    verificationData?.metrics?.ic;

  const trendPoints = useMemo(() => {
    const chronologicalDates = [...timeline].reverse();
    return chronologicalDates
      .map((date) => {
        const daily = dailyByDate.get(date)?.report;
        return {
          date: formatDate(date),
          netReturn: pickNumber(daily?.results?.backtest?.netReturn),
          basketDailyReturn: pickNumber(daily?.results?.basketDailyReturn),
        };
      })
      .filter(
        (point) =>
          point.netReturn !== undefined ||
          point.basketDailyReturn !== undefined,
      );
  }, [timeline, dailyByDate]);

  if (
    !report &&
    stageRows.length === 0 &&
    trendPoints.length === 0 &&
    !verificationData
  ) {
    return <div className="empty">金融メトリクスの根拠ログがありません。</div>;
  }

  return (
    <div
      className="financial-view"
      style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
    >
      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="label">Gross Return</div>
          <div className="value">
            {formatSignedPercentNullable(pickNumber(backtest?.grossReturn))}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Net Return</div>
          <div className="value">
            {formatSignedPercentNullable(pickNumber(backtest?.netReturn))}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Total Cost</div>
          <div className="value">
            {formatBpsNullable(pickNumber(backtest?.totalCostBps))}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Fee / Slippage</div>
          <div className="value">
            {pickNumber(backtest?.feeBps) === undefined &&
            pickNumber(backtest?.slippageBps) === undefined
              ? "欠損"
              : `${formatBpsNullable(pickNumber(backtest?.feeBps))} / ${formatBpsNullable(pickNumber(backtest?.slippageBps))}`}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Sharpe</div>
          <div className="value">{formatNullableNumber(sharpeRatio, 3)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Max Drawdown</div>
          <div className="value">
            {formatSignedPercentNullable(maxDrawdown)}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">Volatility</div>
          <div className="value">{formatNullableNumber(volatility, 4)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">CAGR</div>
          <div className="value">{formatPercentNullable(cagr)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Win Rate</div>
          <div className="value">{formatPercentNullable(winRate)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Profit Factor</div>
          <div className="value">{formatNullableNumber(profitFactor, 3)}</div>
        </article>
        <article className="kpi-card">
          <div className="label">Information Ratio</div>
          <div className="value">
            {formatNullableNumber(informationRatio, 3)}
          </div>
        </article>
        <article className="kpi-card">
          <div className="label">IC</div>
          <div className="value">
            {formatNullableNumber(informationCoefficient, 3)}
          </div>
        </article>
      </section>

      <section className="panel section">
        <div className="section-head">
          <h3>Return Trend</h3>
          <span>Net Return vs Basket Daily Return</span>
        </div>
        {trendPoints.length > 0 ? (
          <div
            className="chart-host"
            style={{ height: "300px", marginTop: "1rem" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendPoints}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={false}
                  tickFormatter={(val) => `${(val * 100).toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--glass-bg)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number | string | undefined) => {
                    const num =
                      typeof val === "string" ? Number.parseFloat(val) : val;
                    return [
                      num !== undefined ? `${(num * 100).toFixed(3)}%` : "N/A",
                      "",
                    ];
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--ink-soft)"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotone"
                  dataKey="netReturn"
                  name="Net Return"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--brand)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="basketDailyReturn"
                  name="Basket Daily Return"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--accent)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">Return時系列が不足しています。</div>
        )}
      </section>

      <section className="panel section">
        <div className="section-head">
          <h3>Stage Metrics</h3>
          <span>benchmark / investment_outcome</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((row) => (
                <tr key={`${row.source}:${row.stage}:${row.key}`}>
                  <td>{row.source}</td>
                  <td>{row.stage}</td>
                  <td>
                    <span className={`chip ${chipClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.key}</td>
                  <td>{formatNullableNumber(row.value, 6)}</td>
                </tr>
              ))}
              {stageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    stage metrics は未検出です。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
