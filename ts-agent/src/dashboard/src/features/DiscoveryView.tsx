import type React from "react";
import type {
  AlphaDiscoveryPayload,
  StandardVerificationData,
} from "../dashboard_core";
import {
  formatNullableNumber,
  formatPercent,
  formatSignedPercentNullable,
} from "../dashboard_core";

interface DiscoveryViewProps {
  payload?: AlphaDiscoveryPayload;
  verificationData?: StandardVerificationData;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  payload,
  verificationData,
}) => {
  if (!payload?.candidates || payload.candidates.length === 0) {
    return <div className="empty">直行アルファ探索ログは未検出です。</div>;
  }

  const selected = payload.selected ?? [];
  const candidates = [...payload.candidates].sort(
    (a, b) => b.scores.priority - a.scores.priority,
  );
  const rejected = candidates.filter(
    (candidate) => candidate.status === "REJECTED",
  );

  return (
    <div className="discovery-view">
      <div className="alpha-top">
        <div className="alpha-selected">
          {selected.length > 0 ? (
            selected.map((id) => (
              <span key={id} className="chip ready">
                {id}
              </span>
            ))
          ) : (
            <span className="chip caution">採択なし</span>
          )}
        </div>
        <div className="alpha-meta">
          sample {payload.evidence.sampleSize} / selected ratio{" "}
          {formatPercent(payload.evidence.selectionRate, 1)}
        </div>
      </div>

      {payload.quality.missingFields.length > 0 && (
        <div
          className="integrity-indicator risk"
          style={{ marginBottom: "0.7rem" }}
        >
          欠損フィールド: {payload.quality.missingFields.join(", ")}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>候補</th>
              <th>Priority</th>
              <th>Plausibility</th>
              <th>Risk-Adjusted</th>
              <th>Novelty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {candidates.slice(0, 10).map((candidate) => (
              <tr key={candidate.id}>
                <td title={candidate.reasoning ?? ""}>
                  <strong>{candidate.id}</strong>
                </td>
                <td>{formatNullableNumber(candidate.scores.priority, 3)}</td>
                <td>
                  {formatNullableNumber(candidate.scores.plausibility, 3)}
                </td>
                <td>
                  {formatNullableNumber(candidate.scores.riskAdjusted, 3)}
                </td>
                <td>{formatNullableNumber(candidate.scores.novelty, 3)}</td>
                <td>
                  <span
                    className={`chip ${candidate.status === "SELECTED" ? "ready" : "caution"}`}
                  >
                    {candidate.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejected.length > 0 && (
        <section className="panel section" style={{ marginTop: "0.8rem" }}>
          <div className="section-head">
            <h3>棄却理由</h3>
            <span>{rejected.length} 件</span>
          </div>
          <div className="thesis-block">
            {rejected.slice(0, 5).map((candidate) => (
              <div key={candidate.id} className="thesis-row">
                {candidate.id}: {candidate.rejectReason ?? "No reason provided"}
              </div>
            ))}
          </div>
        </section>
      )}

      {verificationData && (
        <section className="panel section" style={{ marginTop: "1rem" }}>
          <div className="section-head">
            <h3>Quantitative Verification (Standardized)</h3>
            <span className="chip ready">{verificationData.strategyId}</span>
          </div>
          <div className="thesis-block" style={{ marginBottom: "1rem" }}>
            <div className="thesis-row">
              <strong>Strategy:</strong> {verificationData.strategyName}
            </div>
            <div className="thesis-row">
              <strong>Audit Hash:</strong>{" "}
              {verificationData.audit.commitHash.slice(0, 7)}
            </div>
            {verificationData.description && (
              <div className="thesis-row">
                <strong>Description:</strong> {verificationData.description}
              </div>
            )}
          </div>

          {verificationData.metrics && (
            <div className="kpi-grid" style={{ marginBottom: "1rem" }}>
              <article className="kpi-card">
                <div className="label">Sharpe</div>
                <div className="value">
                  {formatNullableNumber(verificationData.metrics.sharpe, 2)}
                </div>
              </article>
              <article className="kpi-card">
                <div className="label">IC</div>
                <div className="value">
                  {formatNullableNumber(verificationData.metrics.ic, 3)}
                </div>
              </article>
              <article className="kpi-card">
                <div className="label">Max Drawdown</div>
                <div className="value risk">
                  {formatSignedPercentNullable(
                    verificationData.metrics.maxDD
                      ? verificationData.metrics.maxDD / 100
                      : undefined,
                  )}
                </div>
              </article>
              <article className="kpi-card">
                <div className="label">Total Return</div>
                <div className="value pos">
                  {formatSignedPercentNullable(
                    verificationData.metrics.totalReturn
                      ? verificationData.metrics.totalReturn / 100
                      : undefined,
                  )}
                </div>
              </article>
            </div>
          )}

          {verificationData.costs && (
            <div
              className="thesis-block"
              style={{
                marginBottom: "1rem",
                fontSize: "0.8rem",
                color: "gray",
              }}
            >
              Est. Costs: {verificationData.costs.totalCostBps}bps (Fee:{" "}
              {verificationData.costs.feeBps}bps, Slippage:{" "}
              {verificationData.costs.slippageBps}bps)
            </div>
          )}

          <div className="plot-container" style={{ textAlign: "center" }}>
            <img
              src={`${import.meta.env.BASE_URL}verification/${verificationData.fileName}`}
              alt="Alpha Verification Plot"
              style={{
                maxWidth: "100%",
                borderRadius: "var(--radius)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                border: "1px solid var(--border)",
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
};
