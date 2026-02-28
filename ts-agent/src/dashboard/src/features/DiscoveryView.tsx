import type React from "react";
import type { AlphaDiscoveryPayload } from "../dashboard_core";
import { formatNullableNumber, formatPercent } from "../dashboard_core";

interface DiscoveryViewProps {
  payload?: AlphaDiscoveryPayload;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ payload }) => {
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
    </div>
  );
};
