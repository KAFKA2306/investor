import type React from "react";
import {
  Bar,
  BarChart,
  Cell,
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

  return (
    <div className="main">
      <div className="section-head">
        <h2>System Health</h2>
        <span className={`chip ${chipClass(qualityGate.verdict)}`}>
          {qualityGate.verdict}
        </span>
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">{qualityGate.score.toFixed(1)}</h1>
          <p className="hero-subtitle">Total Readiness Score</p>
          <div className="confidence-track" style={{ marginTop: "1rem" }}>
            <div
              className="confidence-bar"
              style={{ width: `${qualityGate.score}%` }}
            />
          </div>
          <p className="hero-reason" style={{ fontSize: "0.8rem" }}>
            Derived from {qualityGate.derivedFrom.length} independent signals.
          </p>
        </div>
        <div className="hero-side">
          <div className="chart-recharts-wrapper" style={{ height: "150px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip />
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
        <div className="panel section">
          <h3 className="quick-title">Provider Connectivity</h3>
          <div className="main" style={{ marginTop: "1rem" }}>
            {providers.map(([name, data]: [string, any]) => (
              <div key={name} className="health-row">
                <span style={{ fontWeight: 600 }}>{name.toUpperCase()}</span>
                <span className={`chip ${chipClass(data.status)}`}>
                  {data.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel section">
          <h3 className="quick-title">Component Breakdown</h3>
          <div className="main" style={{ marginTop: "1rem" }}>
            {Object.entries(qualityGate.components).map(([name, score]) => (
              <div key={name} className="score-bar-grid">
                <span
                  className="score-bar-label"
                  style={{ fontSize: "0.7rem" }}
                >
                  {name}
                </span>
                <div className="score-bar-bg" style={{ height: "6px" }}>
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${score}%`,
                      background:
                        score >= 80 ? "var(--brand)" : "var(--accent)",
                    }}
                  />
                </div>
                <span
                  className="score-bar-value"
                  style={{ fontSize: "0.7rem" }}
                >
                  {score.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel section">
        <h3 className="quick-title">Educational Note</h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          Ready for alpha discovery requires a score of 80+. Current verdict is{" "}
          <strong className={`pos ${chipClass(qualityGate.verdict)}`}>
            {qualityGate.verdict}
          </strong>
          . Connectivity checks ensure that market data providers (J-Quants) and
          macro data (e-Stat, EDINET) are accessible and returning fresh data.
        </p>
      </div>

      <RawDataToggle data={qualityGate} fileName="quality_gate.json" />
    </div>
  );
};
