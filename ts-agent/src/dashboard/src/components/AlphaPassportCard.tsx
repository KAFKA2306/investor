import type React from "react";
import { ASTViewer } from "./ASTViewer";

interface ScoreBarProps {
  label: string;
  value: number;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value }) => {
  const getBarColor = (val: number) => {
    if (val >= 0.7) return "var(--brand)";
    if (val >= 0.4) return "var(--accent)";
    return "var(--danger)";
  };

  return (
    <div className="score-bar-grid">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-bg">
        <div
          className="score-bar-fill"
          style={{
            width: `${value * 100}%`,
            background: getBarColor(value),
          }}
        />
      </div>
      <span className="score-bar-value">{(value * 100).toFixed(0)}</span>
    </div>
  );
};

interface AlphaPassportCardProps {
  id: string;
  description: string;
  reasoning: string;
  scores: {
    priority: number;
    plausibility: number;
    riskAdjusted: number;
    novelty: number;
  };
  status: string;
  rejectReason?: string;
  featureSignature?: string;
  ast?: unknown;
  // [NEW] Drill-down metadata
  docId?: string;
  edinetCode?: string;
  referenceLinks?: string[];
}

export const AlphaPassportCard: React.FC<AlphaPassportCardProps> = ({
  id,
  description,
  reasoning,
  scores,
  status,
  rejectReason,
  featureSignature,
  ast,
  docId,
  edinetCode,
  referenceLinks,
}) => {
  return (
    <div className={`passport-card ${status.toLowerCase()}`}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="chip ready"
          style={{
            background:
              status === "SELECTED"
                ? "var(--brand-soft)"
                : "var(--danger-soft)",
            color: status === "SELECTED" ? "var(--brand)" : "var(--danger)",
          }}
        >
          {status}
        </span>
        <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>
          ID: {id}
        </span>
      </div>

      <div>
        <h4 style={{ margin: "0 0 0.5rem" }}>{description}</h4>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
          {reasoning}
        </p>
      </div>

      <div
        style={{
          background: "rgba(0,0,0,0.02)",
          padding: "0.8rem",
          borderRadius: "8px",
        }}
      >
        <ScoreBar label="Priority" value={scores.priority} />
        <ScoreBar label="Plausibility" value={scores.plausibility} />
        <ScoreBar label="Risk Adj." value={scores.riskAdjusted} />
        <ScoreBar label="Novelty" value={scores.novelty} />
      </div>

      {featureSignature && (
        <div>
          <span className="quick-title">Signature</span>
          <div
            className="ast-viewer"
            style={{ marginTop: "0.4rem", color: "var(--ink-soft)" }}
          >
            {String(featureSignature)}
          </div>
        </div>
      )}

      {ast && (
        <div>
          <span className="quick-title">Logic Tree (AST)</span>
          <div style={{ marginTop: "0.4rem" }}>
            <ASTViewer ast={ast as any} />
          </div>
        </div>
      )}

      {status === "REJECTED" && rejectReason && (
        <div style={{ color: "var(--danger)", fontSize: "0.8rem" }}>
          <strong>Reject Reason:</strong> {rejectReason}
        </div>
      )}

      {(docId || edinetCode || referenceLinks) && (
        <div
          style={{
            marginTop: "0.8rem",
            paddingTop: "0.8rem",
            borderTop: "1px dashed var(--brand-divider)",
            fontSize: "0.75rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {docId && (
            <span className="pill ready" title="Source Document ID">
              Doc: {docId}
            </span>
          )}
          {edinetCode && (
            <span className="pill ready" title="EDINET Code">
              Entity: {edinetCode}
            </span>
          )}
          {referenceLinks?.map((link, idx) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="pill ready"
              style={{ textDecoration: "none" }}
            >
              Ref {idx + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
