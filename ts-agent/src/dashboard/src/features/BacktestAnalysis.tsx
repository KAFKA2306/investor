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
import { AlphaValidationResults } from "../components/AlphaValidationResults";
import { DrawdownChart } from "../components/DrawdownChart";
import { MetricCard } from "../components/MetricCard";
import { RawDataToggle } from "../components/RawDataToggle";
import {
  collectStageMetricRows,
  computeDrawdownSeries,
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
        <h2>バックテスト詳細解析 📊✨</h2>
      </div>

      <div className="panel section">
        <h3 className="quick-title">✨ アルファ品質ゲート検証</h3>
        <AlphaValidationResults verificationData={verificationData} />
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">パフォーマンス深掘り 💎</h1>
          <p className="hero-subtitle">
            検証済みアルファの構造的特性と、運用実績の比較を行うよ。
          </p>
          <div className="uqtl-grid" style={{ marginTop: "1rem" }}>
            <MetricCard
              label="累積リターン (Total R)"
              value={verificationData.metrics?.totalReturn ?? 0}
              unit="%"
              sourcePath="metrics.totalReturn"
              derivation={{
                id: "recomputeTotalReturn",
                note: "基準日からの累積収益率だよっ！",
                inputs: ["strategyCum"],
              }}
            />
            <MetricCard
              label="シャープレシオ (Sharpe)"
              value={verificationData.metrics?.sharpe ?? 0}
              sourcePath="metrics.sharpe"
              derivation={{
                id: "recomputeSharpe",
                note: "年率換算のリスク調整後リターンだよっ！",
                inputs: ["strategyCum"],
              }}
              trend={recomputeSharpe(rawDailyReturnsArray) >= 0 ? "up" : "down"}
            />
            <MetricCard
              label="最大ドローダウン (MaxDD)"
              value={(verificationData.metrics?.maxDD ?? 0) * 100}
              unit="%"
              sourcePath="metrics.maxDD"
              derivation={{
                id: "recomputeMaxDD",
                note: "ピークからの最大下落率だよぉ…",
                inputs: ["strategyCum", "dates"],
              }}
              trend="down"
            />
          </div>
        </div>
      </div>

      <div
        className="panel section"
        style={{ border: "1px solid var(--line)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3 className="quick-title" style={{ margin: 0 }}>
            現行バックテスト vs 過去の運用実績 (%)
          </h3>
          <div style={{ fontSize: "0.6rem", display: "flex", gap: "1rem" }}>
            <span
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "var(--brand)",
                  borderRadius: "2px",
                }}
              ></span>
              今回のバックテスト
            </span>
            <span
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "var(--accent)",
                  border: "1px dashed var(--accent)",
                  borderRadius: "2px",
                }}
              ></span>
              過去のプロダクション実績
            </span>
          </div>
        </div>
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
                  fontSize: "12px",
                  background: "var(--bg-panel)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="今回の試算"
                stroke="var(--brand)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="historical"
                name="過去の実績"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel section">
        <h3 className="quick-title">構造的ドローダウン解析 📉</h3>
        <DrawdownChart data={drawdownPoints} />
      </div>

      <div className="panel section" style={{ background: "rgba(0,0,0,0.02)" }}>
        <h3 className="quick-title">テクニカル・グロッサリー 📖</h3>
        <div className="main" style={{ marginTop: "1rem", gap: "1.5rem" }}>
          <div>
            <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
              シャープレシオ (Sharpe Ratio)
            </strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.3rem 0",
                lineHeight: 1.5,
              }}
            >
              取ったリスク（標準偏差）に対して、どれだけのリターンを得られたかを示す指標だよ。
              クオンツ戦略では 1.5 以上が優秀、2.0
              を超えると最高にキラキラしてる判定になるんだもんっ！✨
            </p>
          </div>
          <div>
            <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
              情報係数 (Information Coefficient - IC)
            </strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.3rem 0",
                lineHeight: 1.5,
              }}
            >
              予測したアルファと、実際に発生したリターンの相関関係だよ。
              この値が高いほど、システムの「予知能力」が正確であることを証明してくれるんだもんっ！🔍
            </p>
          </div>
          <div>
            <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
              最大ドローダウン (Max Drawdown)
            </strong>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                margin: "0.3rem 0",
                lineHeight: 1.5,
              }}
            >
              累積リターンのピークから底までの最大下落率のこと。
              リスク管理において最も重要な数字の一つで、運用を続けるための「体力測定」みたいなものだねっ📉
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
