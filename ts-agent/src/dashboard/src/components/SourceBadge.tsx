import type React from "react";

interface SourceBadgeProps {
  codeFingerprint: string;
  dataFingerprint?: string;
  runFingerprint: {
    runId: string;
    startedAt: string;
    environment: string;
  };
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  codeFingerprint,
  dataFingerprint,
  runFingerprint,
}) => {
  return (
    <div
      className="source-badge"
      style={{
        display: "flex",
        gap: "0.8rem",
        flexWrap: "wrap",
        padding: "0.4rem",
      }}
    >
      <div title="Code Fingerprint (Commit Hash)">
        <span style={{ color: "var(--ink-soft)", marginRight: "4px" }}>
          Code:
        </span>
        <span style={{ fontWeight: 600 }}>{codeFingerprint.slice(0, 7)}</span>
      </div>

      {dataFingerprint && (
        <div title="Data Fingerprint (Input Hash)">
          <span style={{ color: "var(--ink-soft)", marginRight: "4px" }}>
            Data:
          </span>
          <span style={{ fontWeight: 600 }}>{dataFingerprint.slice(0, 7)}</span>
        </div>
      )}

      <div
        title={`Run: ${runFingerprint.runId} (${runFingerprint.environment})`}
      >
        <span style={{ color: "var(--ink-soft)", marginRight: "4px" }}>
          Run:
        </span>
        <span style={{ fontWeight: 600 }}>{runFingerprint.runId}</span>
        <span
          style={{
            color: "var(--ink-soft)",
            marginLeft: "4px",
            fontSize: "0.9em",
          }}
        >
          @ {new Date(runFingerprint.startedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
};
