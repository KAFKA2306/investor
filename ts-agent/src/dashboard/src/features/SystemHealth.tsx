import type React from "react";
import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RawDataToggle } from "../components/RawDataToggle";
import { chipClass, type QualityGatePayload } from "../dashboard_core";

interface SystemHealthProps {
  qualityGate: QualityGatePayload | null;
  history: Map<string, QualityGatePayload>;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({
  qualityGate,
  history,
}) => {
  if (!qualityGate) {
    return <div className="empty">No quality gate information available.</div>;
  }

  const chartData = Array.from(history.entries())
    .map(([date, gate]) => ({
      date: date.slice(4), // MMDD
      score: gate.score,
    }))
    .reverse();

  const providers = Object.entries(qualityGate.connectivity);
  const radarData = Object.entries(qualityGate.components).map(
    ([name, score]) => ({
      subject: name,
      score: score,
      fullMark: 100,
    }),
  );

  return (
    <div className="main">
      <div className="section-head">
        <h2>システムの健康診断 🏥✨</h2>
        <span
          className={`chip ${chipClass(qualityGate.verdict)}`}
          style={{ fontWeight: "bold" }}
        >
          {qualityGate.verdict === "READY" ? "正常稼働中" : "要確認"}
        </span>
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">{qualityGate.score.toFixed(1)}</h1>
          <p className="hero-subtitle">総合システム稼働スコア (Ready %)</p>
          <div className="confidence-track" style={{ marginTop: "1rem" }}>
            <div
              className="confidence-bar"
              style={{
                width: `${qualityGate.score}%`,
                background:
                  "linear-gradient(90deg, var(--brand-soft), var(--brand))",
              }}
            />
          </div>
          <p
            className="hero-reason"
            style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}
          >
            {qualityGate.derivedFrom.length}{" "}
            個の独立した信号から算出された信頼度だよっ！✨
          </p>
        </div>
        <div className="hero-side">
          <div className="chart-recharts-wrapper" style={{ height: "150px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--line)",
                    fontSize: "10px",
                  }}
                />
                <Bar dataKey="score">
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={
                        entry.score >= 80 ? "var(--brand)" : "var(--accent)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="split">
        <div
          className="panel section"
          style={{ border: "1px solid var(--line)" }}
        >
          <h3 className="quick-title">プロバイダー接続状況 🌐</h3>
          <div className="main" style={{ marginTop: "1rem" }}>
            {providers.map(([name, data]) => {
              const d = data as { status: string };
              return (
                <div
                  key={name}
                  className="health-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                    {name.toUpperCase()}
                  </span>
                  <span
                    className={`chip ${chipClass(d.status)}`}
                    style={{ fontSize: "0.65rem" }}
                  >
                    {d.status === "PASS" || d.status === "OK"
                      ? "接続完了"
                      : "エラー"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="panel section"
          style={{ border: "1px solid var(--line)" }}
        >
          <h3 className="quick-title">コンポーネント・パルス (Radar) 📡</h3>
          <div
            className="chart-recharts-wrapper"
            style={{ height: "250px", marginTop: "1rem" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                />
                <Radar
                  name="スコア"
                  dataKey="score"
                  stroke="var(--brand)"
                  fill="var(--brand)"
                  fillOpacity={0.5}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                    background: "var(--bg-panel)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div
        className="panel section"
        style={{
          background: "rgba(0,0,0,0.02)",
          border: "1px solid var(--line)",
        }}
      >
        <h3 className="quick-title">システムの健全性について 📖</h3>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          新しいアルファの探索を開始するには、総合スコアが{" "}
          <strong>80点以上</strong> である必要があるよ。 現在の判定は{" "}
          <strong className={`pos ${chipClass(qualityGate.verdict)}`}>
            {qualityGate.verdict === "READY" ? "合格（Ready）" : "準備中"}
          </strong>{" "}
          だねっ！✨ J-Quants（株価データ）や
          e-Stat（経済統計）、EDINET（企業開示）などの外部ソースへの接続と、各解析エンジンの整合性を常にチェックしているんだもんっ！🔍
        </p>
      </div>

      <RawDataToggle data={qualityGate} fileName="quality_gate.json" />
    </div>
  );
};
