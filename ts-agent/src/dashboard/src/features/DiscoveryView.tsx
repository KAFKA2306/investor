import React from "react";
import type { AlphaDiscoveryPayload } from "../types/schemas";
import { pickNumber, formatPercent } from "../utils/formatters";

interface DiscoveryViewProps {
  payload: AlphaDiscoveryPayload | null;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ payload }) => {
  if (!payload?.candidates || payload.candidates.length === 0) {
    return <div className="empty">直行アルファ探索ログは未検出です。</div>;
  }

  const selected = payload.selected ?? [];
  const candidates = [...payload.candidates].sort(
    (a, b) => pickNumber(b.score) - pickNumber(a.score),
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
          sample {pickNumber(payload.evidence?.sampleSize, 0)} / positive ratio{" "}
          {formatPercent(
            pickNumber(payload.evidence?.positiveReturnRatio, 0),
            1,
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>候補</th>
              <th>Score</th>
              <th>IC proxy</th>
              <th>直行性</th>
              <th>相関</th>
            </tr>
          </thead>
          <tbody>
            {candidates.slice(0, 10).map((candidate) => (
              <tr key={candidate.id}>
                <td title={candidate.reasoning ?? ""}>
                  <strong>{candidate.id}</strong>
                </td>
                <td>{pickNumber(candidate.score).toFixed(3)}</td>
                <td>{pickNumber(candidate.icProxy).toFixed(3)}</td>
                <td>{pickNumber(candidate.orthogonality).toFixed(2)}</td>
                <td>
                  {pickNumber(candidate.correlationToBaseline).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
