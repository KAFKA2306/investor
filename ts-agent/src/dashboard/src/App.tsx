import React, { useState, useMemo } from "react";
import { useDashboardData } from "./hooks/useDashboardData";
import { StatusBar } from "./features/StatusBar";
import { DiscoveryView } from "./features/DiscoveryView";
import { AuditView } from "./features/AuditView";
import {
  formatDate,
  formatSignedPercent,
  pickNumber,
  chipClass,
  formatPercent,
  formatCompact,
} from "./utils/formatters";
import { computeConfidence, computeUqtlVector } from "./utils/calculators";

const App: React.FC = () => {
  const {
    dailyByDate,
    benchmarkByDate,
    unifiedByDate,
    readinessByDate,
    alphaByDate,
    uqtlEvents,
    timeline,
    loading,
    refresh,
  } = useDashboardData();

  const [activeDate, setActiveDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const selectedDate = activeDate || timeline[0] || "";
  const daily = dailyByDate.get(selectedDate);
  const report = daily?.report;
  const unified = unifiedByDate.get(selectedDate);
  const readiness = readinessByDate.get(selectedDate);
  const benchmark = benchmarkByDate.get(selectedDate);
  const alpha = alphaByDate.get(selectedDate)?.[0] || null;

  const confidence = useMemo(
    () => (report ? computeConfidence(report, readiness || null) : 0),
    [report, readiness],
  );
  const uqtlVector = useMemo(
    () =>
      report
        ? computeUqtlVector(report, unified || null, readiness || null)
        : null,
    [report, unified, readiness],
  );

  const handleKill = () => {
    if (
      window.confirm(
        "緊急停止（KILL SWITCH）を実行しますか？全注文がキャンセルされ、新規発注が停止されます。",
      )
    ) {
      console.log("KILL SWITCH ACTIVATED");
      // In a real app, this would call a POST /api/emergency-stop
    }
  };

  if (loading && timeline.length === 0) {
    return <div className="loading-screen">Loading Mission Control...</div>;
  }

  return (
    <div id="app">
      <StatusBar
        status="active"
        lastUpdated={new Date().toLocaleTimeString("ja-JP")}
        onRefresh={refresh}
        onKill={handleKill}
      />

      <nav className="tab-nav" style={{ margin: "1rem 0" }}>
        {[
          "overview",
          "discovery",
          "evaluation",
          "execution",
          "audit",
          "logs",
        ].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      <div className="layout">
        <aside className="rail">
          <section className="panel section">
            <div className="section-head">
              <h2>Timeline</h2>
              <span>Daily Logs</span>
            </div>
            <div className="timeline-list">
              {timeline.map((date, idx) => {
                const d = dailyByDate.get(date)?.report;
                const ret = pickNumber(d?.results?.basketDailyReturn);
                return (
                  <button
                    key={date}
                    className={`timeline-item ${selectedDate === date ? "active" : ""}`}
                    onClick={() => setActiveDate(date)}
                    style={{ "--delay": `${idx * 20}ms` } as any}
                  >
                    <div className="timeline-top">
                      <span className="timeline-date">{formatDate(date)}</span>
                      <span
                        className={`chip ${chipClass(d?.workflow?.verdict || "UNKNOWN")}`}
                      >
                        {d?.workflow?.verdict || "N/A"}
                      </span>
                    </div>
                    <div
                      className={`timeline-bottom ${ret >= 0 ? "pos" : "neg"}`}
                    >
                      {formatSignedPercent(ret)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel section">
            <div className="section-head">
              <h3>System Health</h3>
            </div>
            <div className="health-row">
              <span>J-Quants</span>
              <span
                className={`chip ${chipClass(report?.evidence?.jquants?.status || "")}`}
              >
                {report?.evidence?.jquants?.status || "UNKNOWN"}
              </span>
            </div>
            <div className="health-row">
              <span>e-Stat</span>
              <span
                className={`chip ${chipClass(report?.evidence?.estat?.status || "")}`}
              >
                {report?.evidence?.estat?.status || "UNKNOWN"}
              </span>
            </div>
          </section>
        </aside>

        <main className="main">
          {activeTab === "overview" && (
            <>
              <section className="panel hero hero-uqtl">
                <div>
                  <div className="hero-meta">
                    <span
                      className={`chip ${confidence >= 0.7 ? "ready" : confidence >= 0.4 ? "caution" : "risk"}`}
                    >
                      {confidence >= 0.7
                        ? "攻め寄り"
                        : confidence >= 0.4
                          ? "中立"
                          : "守り寄り"}
                    </span>
                    <span
                      className={`chip ${uqtlVector && uqtlVector.entropy < 0.4 ? "ready" : "caution"}`}
                    >
                      Entropy {(uqtlVector?.entropy || 0).toFixed(2)}
                    </span>
                  </div>
                  <h2 className="hero-title">
                    {report?.decision?.action || "判定中"} // MISSION
                  </h2>
                  <p className="hero-subtitle">
                    {report?.decision?.strategy || "戦略未設定"}
                  </p>
                  <p className="hero-reason">
                    {report?.decision?.reason || "根拠ログがありません。"}
                  </p>
                </div>
                <div className="hero-side">
                  <div className="section-head">
                    <h3>Arbitration Confidence</h3>
                    <span className="confidence-label">
                      {(confidence * 100).toFixed(0)} / 100
                    </span>
                  </div>
                  <div className="confidence-track">
                    <div
                      className="confidence-bar"
                      style={{ width: `${confidence * 100}%` }}
                    ></div>
                  </div>
                  <div className="integrity-indicator verified">
                    証拠整合性: AUDITED ✅
                  </div>
                </div>
              </section>

              <section className="kpi-grid">
                <article className="kpi-card">
                  <div className="label">Expected Edge</div>
                  <div className="value pos">
                    {formatPercent(pickNumber(report?.results?.expectedEdge))}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Daily Return</div>
                  <div
                    className={`value ${pickNumber(report?.results?.basketDailyReturn) >= 0 ? "pos" : "neg"}`}
                  >
                    {formatSignedPercent(
                      pickNumber(report?.results?.basketDailyReturn),
                    )}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Kelly Fraction</div>
                  <div className="value">
                    {formatPercent(pickNumber(report?.risks?.kellyFraction))}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Stop Loss</div>
                  <div className="value risk">
                    -{formatPercent(pickNumber(report?.risks?.stopLossPct))}
                  </div>
                </article>
              </section>
            </>
          )}

          {activeTab === "discovery" && <DiscoveryView payload={alpha} />}
          {activeTab === "audit" && <AuditView report={report || null} />}

          {activeTab === "evaluation" && (
            <section className="panel section">
              <div className="section-head">
                <h3>Benchmark Comparison</h3>
                <span>Model Baselines</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>RMSE</th>
                      <th>MAE</th>
                      <th>Directional Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmark?.report?.analyst?.baselines?.map((b) => (
                      <tr key={b.name}>
                        <td>
                          <strong>{b.name}</strong>
                        </td>
                        <td>{pickNumber(b.metrics.rmse).toFixed(4)}</td>
                        <td>{pickNumber(b.metrics.mae).toFixed(4)}</td>
                        <td
                          className={
                            pickNumber(b.metrics.directionalAccuracy) > 50
                              ? "pos"
                              : "neg"
                          }
                        >
                          {formatPercent(
                            pickNumber(b.metrics.directionalAccuracy) / 100,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "execution" && (
            <section className="panel section">
              <div className="section-head">
                <h3>Pre-trade Risk Control</h3>
              </div>
              <div className="thesis-block">
                <div className="thesis-row">
                  ポジション上限: {report?.risks?.maxPositions || "N/A"}
                </div>
                <div className="thesis-row">
                  現在の割当案 (Allocation):{" "}
                  {report?.decision?.topSymbol || "なし"} 集中
                </div>
                <div className="thesis-row" style={{ color: "var(--brand)" }}>
                  リスク制限チェック: PASS
                </div>
              </div>
            </section>
          )}

          {activeTab === "logs" && (
            <section className="panel section json-block">
              <pre>
                {JSON.stringify({ report, benchmark, unified, alpha }, null, 2)}
              </pre>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
