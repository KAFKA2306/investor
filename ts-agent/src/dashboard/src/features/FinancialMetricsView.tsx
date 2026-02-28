import type React from "react";
import { useMemo } from "react";
import type {
  DailyLogEnvelope,
  DailyReport,
  UnifiedLogPayload,
  StandardVerificationData,
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

const buildLinePath = (
  points: TrendPoint[],
  toX: (index: number) => number,
  toY: (value: number) => number,
  selector: (point: TrendPoint) => number | undefined,
): string => {
  let path = "";
  let drawing = false;
  points.forEach((point, index) => {
    const value = selector(point);
    if (value === undefined) {
      drawing = false;
      return;
    }
    path += `${drawing ? " L" : "M"} ${toX(index)} ${toY(value)}`;
    drawing = true;
  });
  return path;
};

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
    (verificationData?.metrics?.maxDD ? verificationData.metrics.maxDD / 100 : undefined);
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
          date,
          netReturn: pickNumber(daily?.results?.backtest?.netReturn),
          basketDailyReturn: pickNumber(daily?.results?.basketDailyReturn),
        } satisfies TrendPoint;
      })
      .filter(
        (point) =>
          point.netReturn !== undefined ||
          point.basketDailyReturn !== undefined,
      );
  }, [timeline, dailyByDate]);

  const chart = useMemo(() => {
    if (trendPoints.length === 0) return null;
    const values = trendPoints.flatMap((point) => {
      const rows: number[] = [];
      if (point.netReturn !== undefined) rows.push(point.netReturn);
      if (point.basketDailyReturn !== undefined)
        rows.push(point.basketDailyReturn);
      return rows;
    });
    if (values.length === 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1e-9);
    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const xSpan = Math.max(trendPoints.length - 1, 1);

    const toX = (index: number) =>
      CHART_PADDING + ((width - CHART_PADDING * 2) * index) / xSpan;
    const toY = (value: number) =>
      CHART_PADDING + ((height - CHART_PADDING * 2) * (max - value)) / span;

    const netPath = buildLinePath(
      trendPoints,
      toX,
      toY,
      (point) => point.netReturn,
    );
    const basketPath = buildLinePath(
      trendPoints,
      toX,
      toY,
      (point) => point.basketDailyReturn,
    );

    const latestNet = [...trendPoints]
      .reverse()
      .find((point) => point.netReturn !== undefined);
    const latestBasket = [...trendPoints]
      .reverse()
      .find((point) => point.basketDailyReturn !== undefined);

    return {
      width,
      height,
      min,
      max,
      netPath,
      basketPath,
      latestNet,
      latestBasket,
      toX,
      toY,
      firstDate: trendPoints[0]?.date ?? "",
      lastDate: trendPoints[trendPoints.length - 1]?.date ?? "",
    };
  }, [trendPoints]);

  if (!report && stageRows.length === 0 && !chart && !verificationData) {
    return <div className="empty">金融メトリクスの根拠ログがありません。</div>;
  }

  return (
    <div
      className="financial-view"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
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
        {chart ? (
          <div className="chart-host">
            <svg
              className="line-chart"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="img"
              aria-label="financial return trend"
            >
              <line
                className="chart-grid-line"
                x1={CHART_PADDING}
                y1={CHART_PADDING}
                x2={chart.width - CHART_PADDING}
                y2={CHART_PADDING}
              />
              <line
                className="chart-grid-line mid"
                x1={CHART_PADDING}
                y1={chart.height / 2}
                x2={chart.width - CHART_PADDING}
                y2={chart.height / 2}
              />
              <line
                className="chart-grid-line"
                x1={CHART_PADDING}
                y1={chart.height - CHART_PADDING}
                x2={chart.width - CHART_PADDING}
                y2={chart.height - CHART_PADDING}
              />
              {chart.netPath && (
                <path d={chart.netPath} className="chart-line" />
              )}
              {chart.basketPath && (
                <path
                  d={chart.basketPath}
                  className="chart-line chart-line-alt"
                />
              )}
              {chart.latestNet?.netReturn !== undefined && (
                <circle
                  className="chart-point-active"
                  cx={chart.toX(trendPoints.indexOf(chart.latestNet))}
                  cy={chart.toY(chart.latestNet.netReturn)}
                  r="3.2"
                />
              )}
              {chart.latestBasket?.basketDailyReturn !== undefined && (
                <circle
                  className="chart-point-alt"
                  cx={chart.toX(trendPoints.indexOf(chart.latestBasket))}
                  cy={chart.toY(chart.latestBasket.basketDailyReturn)}
                  r="3.2"
                />
              )}
            </svg>
            <div className="financial-chart-legend">
              <span className="legend-item">
                <span className="legend-dot legend-dot-net" />
                Net Return
              </span>
              <span className="legend-item">
                <span className="legend-dot legend-dot-daily" />
                Basket Daily Return
              </span>
              <span className="legend-boundary">
                {formatDate(chart.firstDate)} - {formatDate(chart.lastDate)}
              </span>
              <span className="legend-boundary">
                min {formatPercentNullable(chart.min)} / max{" "}
                {formatPercentNullable(chart.max)}
              </span>
            </div>
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
