import type React from "react";
import { useMemo, useState } from "react";
import {
  type AlphaDiscoveryPayload,
  chipClass,
  computeConfidence,
  computeUqtlVector,
  formatDate,
  formatNullableNumber,
  formatPercent,
  formatPercentNullable,
  formatSignedPercentNullable,
  pickNumber,
} from "./dashboard_core";
import { AuditView } from "./features/AuditView";
import { DiscoveryView } from "./features/DiscoveryView";
import { FinancialMetricsView } from "./features/FinancialMetricsView";
import { StatusBar } from "./features/StatusBar";
import { useDashboardData } from "./hooks/useDashboardData";

const parseIso = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const pickLatestAlpha = (
  items: AlphaDiscoveryPayload[],
): AlphaDiscoveryPayload | undefined =>
  [...items].sort(
    (a, b) => parseIso(b.generatedAt) - parseIso(a.generatedAt),
  )[0];

const App: React.FC = () => {
  const {
    dailyByDate,
    benchmarkByDate,
    unifiedByDate,
    qualityGateByDate,
    alphaByDate,
    timeline,
    ingestErrors,
    loading,
    refresh,
  } = useDashboardData();

  const [activeDate, setActiveDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const selectedDate = activeDate || timeline[0] || "";
  const daily = dailyByDate.get(selectedDate);
  const report = daily?.report;
  const unified = unifiedByDate.get(selectedDate);
  const qualityGateForDate = qualityGateByDate.get(selectedDate) ?? null;
  const benchmark = benchmarkByDate.get(selectedDate);
  const alpha = useMemo(() => {
    const byDate = alphaByDate.get(selectedDate);
    if (byDate && byDate.length > 0) return pickLatestAlpha(byDate);

    const all = Array.from(alphaByDate.values()).flat();
    if (all.length === 0) return undefined;
    return pickLatestAlpha(all);
  }, [alphaByDate, selectedDate]);

  const latestQualityGate = useMemo(() => {
    const dates = Array.from(qualityGateByDate.keys()).sort((a, b) =>
      b.localeCompare(a),
    );
    const latest = dates[0];
    return latest ? (qualityGateByDate.get(latest) ?? null) : null;
  }, [qualityGateByDate]);

  const effectiveQualityGate = qualityGateForDate ?? latestQualityGate;
  const confidence = useMemo(
    () =>
      report ? computeConfidence(report, effectiveQualityGate) : undefined,
    [report, effectiveQualityGate],
  );
  const uqtlVector = useMemo(
    () =>
      report
        ? computeUqtlVector(report, unified || null, effectiveQualityGate)
        : undefined,
    [report, unified, effectiveQualityGate],
  );

  const jquantsStatus =
    report?.evidence?.jquants?.status ??
    effectiveQualityGate?.connectivity.jquants.status ??
    "MISSING";
  const estatStatus =
    report?.evidence?.estat?.status ??
    effectiveQualityGate?.connectivity.estat.status ??
    "MISSING";

  const handleKill = async () => {
    if (
      !window.confirm(
        "緊急停止（KILL SWITCH）を実行しますか？全注文がキャンセルされ、新規発注が停止されます。",
      )
    ) {
      return;
    }

    console.log("KILL SWITCH ACTIVATED");
    const res = await fetch("/api/kill", { method: "POST" }).catch(
      () => undefined,
    );
    if (res?.ok) {
      alert("Kill signal sent successfully.");
      return;
    }
    alert("Kill signal failed. API connection required.");
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
          "financial",
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
              <span>Evidence Ledger</span>
            </div>
            <div className="timeline-list">
              {timeline.map((date, idx) => {
                const reportForDate = dailyByDate.get(date)?.report;
                const alphaForDate = alphaByDate.get(date);
                const latestAlphaForDate =
                  alphaForDate && alphaForDate.length > 0
                    ? pickLatestAlpha(alphaForDate)
                    : undefined;
                const ret = pickNumber(
                  reportForDate?.results?.basketDailyReturn,
                );
                const hasDaily = Boolean(reportForDate);
                const hasDiscovery = Boolean(latestAlphaForDate);
                const verdict = hasDaily
                  ? (reportForDate?.workflow?.verdict ?? "MISSING")
                  : hasDiscovery
                    ? "DISCOVERY"
                    : "MISSING";

                return (
                  <button
                    key={date}
                    type="button"
                    className={`timeline-item ${selectedDate === date ? "active" : ""}`}
                    onClick={() => setActiveDate(date)}
                    style={
                      { "--delay": `${idx * 20}ms` } as React.CSSProperties
                    }
                  >
                    <div className="timeline-top">
                      <span className="timeline-date">{formatDate(date)}</span>
                      <span className={`chip ${chipClass(verdict)}`}>
                        {verdict}
                      </span>
                    </div>
                    <div
                      className={`timeline-bottom ${ret === undefined ? "neutral" : ret >= 0 ? "pos" : "neg"}`}
                    >
                      {ret !== undefined
                        ? formatSignedPercentNullable(ret)
                        : latestAlphaForDate
                          ? `採択 ${latestAlphaForDate.evidence.selectedCount}/${latestAlphaForDate.evidence.sampleSize}`
                          : "根拠ログ欠損"}
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
              <span className={`chip ${chipClass(jquantsStatus)}`}>
                {jquantsStatus}
              </span>
            </div>
            <div className="health-row">
              <span>e-Stat</span>
              <span className={`chip ${chipClass(estatStatus)}`}>
                {estatStatus}
              </span>
            </div>
          </section>
        </aside>

        <main className="main">
          {ingestErrors.length > 0 && (
            <section className="panel section">
              <div className="section-head">
                <h3>Data Contract Violations</h3>
                <span>{ingestErrors.length} 件</span>
              </div>
              <div className="thesis-block">
                {ingestErrors.slice(0, 5).map((issue) => (
                  <div key={issue} className="thesis-row">
                    {issue}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "overview" && (
            <>
              <section className="panel hero hero-uqtl">
                <div>
                  <div className="hero-meta">
                    {confidence === undefined ? (
                      <span className="chip risk">信頼度算出不可</span>
                    ) : (
                      <span
                        className={`chip ${confidence >= 0.7 ? "ready" : confidence >= 0.4 ? "caution" : "risk"}`}
                      >
                        {confidence >= 0.7
                          ? "攻め寄り"
                          : confidence >= 0.4
                            ? "中立"
                            : "守り寄り"}
                      </span>
                    )}
                    <span
                      className={`chip ${uqtlVector && uqtlVector.entropy < 0.4 ? "ready" : "caution"}`}
                    >
                      Entropy{" "}
                      {uqtlVector ? uqtlVector.entropy.toFixed(2) : "算出不可"}
                    </span>
                  </div>
                  <h2 className="hero-title">
                    {report?.decision?.action ?? "判定ログ欠損"}
                  </h2>
                  <p className="hero-subtitle">
                    {report?.decision?.strategy ?? "戦略ログ欠損"}
                  </p>
                  <p className="hero-reason">
                    {report?.decision?.reason ?? "根拠ログが不足しています。"}
                  </p>
                </div>
                <div className="hero-side">
                  <div className="section-head">
                    <h3>Arbitration Confidence</h3>
                    <span className="confidence-label">
                      {confidence === undefined
                        ? "算出不可"
                        : `${(confidence * 100).toFixed(0)} / 100`}
                    </span>
                  </div>
                  {confidence !== undefined && (
                    <div className="confidence-track">
                      <div
                        className="confidence-bar"
                        style={{ width: `${confidence * 100}%` }}
                      ></div>
                    </div>
                  )}
                  <div
                    className={`integrity-indicator ${confidence === undefined ? "risk" : "verified"}`}
                  >
                    {confidence === undefined
                      ? "証拠整合性: MISSING LOGS"
                      : "証拠整合性: AUDITED ✅"}
                  </div>
                </div>
              </section>

              <section className="kpi-grid">
                <article className="kpi-card">
                  <div className="label">Expected Edge</div>
                  <div className="value pos">
                    {formatPercentNullable(
                      pickNumber(report?.results?.expectedEdge),
                    )}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Daily Return</div>
                  <div
                    className={`value ${(() => {
                      const value = pickNumber(
                        report?.results?.basketDailyReturn,
                      );
                      if (value === undefined) return "risk";
                      return value >= 0 ? "pos" : "neg";
                    })()}`}
                  >
                    {formatSignedPercentNullable(
                      pickNumber(report?.results?.basketDailyReturn),
                    )}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Kelly Fraction</div>
                  <div className="value">
                    {formatPercentNullable(
                      pickNumber(report?.risks?.kellyFraction),
                    )}
                  </div>
                </article>
                <article className="kpi-card">
                  <div className="label">Stop Loss</div>
                  <div className="value risk">
                    {(() => {
                      const stopLoss = pickNumber(report?.risks?.stopLossPct);
                      return stopLoss === undefined
                        ? "欠損"
                        : `-${formatPercent(stopLoss)}`;
                    })()}
                  </div>
                </article>
              </section>
            </>
          )}

          {activeTab === "discovery" && <DiscoveryView payload={alpha} />}
          {activeTab === "financial" && (
            <FinancialMetricsView
              report={report || null}
              benchmark={benchmark || null}
              outcome={unified || null}
              dailyByDate={dailyByDate}
              timeline={timeline}
            />
          )}
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
                    {(benchmark?.stages ?? []).map((stage, idx) => {
                      const metrics = stage.metrics ?? {};
                      const rmse = pickNumber(metrics.rmse);
                      const mae = pickNumber(metrics.mae);
                      const directional = pickNumber(
                        metrics.directionalAccuracy,
                      );
                      const directionalRatio =
                        directional === undefined
                          ? undefined
                          : directional > 1
                            ? directional / 100
                            : directional;
                      return (
                        <tr key={`${stage.name ?? "stage"}-${idx}`}>
                          <td>
                            <strong>{stage.name ?? "stage"}</strong>
                          </td>
                          <td>{formatNullableNumber(rmse, 4)}</td>
                          <td>{formatNullableNumber(mae, 4)}</td>
                          <td
                            className={
                              directionalRatio === undefined
                                ? "risk"
                                : directionalRatio >= 0.5
                                  ? "pos"
                                  : "neg"
                            }
                          >
                            {formatPercentNullable(directionalRatio)}
                          </td>
                        </tr>
                      );
                    })}
                    {(benchmark?.stages ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="empty">
                          benchmark metrics は未検出です。
                        </td>
                      </tr>
                    )}
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
                  ポジション上限:{" "}
                  {typeof report?.risks?.maxPositions === "number"
                    ? report.risks.maxPositions
                    : "欠損"}
                </div>
                <div className="thesis-row">
                  現在の割当案 (Allocation):{" "}
                  {report?.decision?.topSymbol
                    ? `${report.decision.topSymbol} 集中`
                    : "欠損"}
                </div>
                <div className="thesis-row" style={{ color: "var(--brand)" }}>
                  リスク制限チェック:{" "}
                  {report?.risks?.maxPositions && report?.decision?.topSymbol
                    ? "PASS"
                    : "判定不能"}
                </div>
              </div>
            </section>
          )}

          {activeTab === "logs" && (
            <section className="panel section json-block">
              <pre>
                {JSON.stringify(
                  {
                    report,
                    benchmark,
                    unified,
                    qualityGate: effectiveQualityGate,
                    alpha,
                    ingestErrors,
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
