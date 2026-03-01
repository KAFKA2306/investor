import type React from "react";

interface StatusBarProps {
  status: "active" | "emergency";
  lastUpdated: string;
  commitHash?: string;
  dataFingerprint?: string;
  runId?: string;
  environment?: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRefresh: () => void;
  onKill: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  lastUpdated,
  commitHash,
  dataFingerprint,
  runId,
  environment,
  activeTab,
  onTabChange,
  onRefresh,
  onKill,
}) => {
  const tabs = [
    { id: "evidence", label: "Evidence Room" },
    { id: "inspector", label: "Data Inspector" },
    { id: "research", label: "Research Log" },
    { id: "health", label: "System Health" },
    { id: "backtest", label: "Analysis" },
  ];

  const hasFingerprints = Boolean(commitHash);

  return (
    <header
      className="topbar panel"
      style={{ flexWrap: "wrap", gap: "0.5rem" }}
    >
      <div className="brand">
        <h1>Hypothesis Evolution</h1>
        <p>Visual Proof + Immutable Evidence</p>
      </div>

      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <span className="pill mono" style={{ fontSize: "0.65rem" }}>
          updated:{lastUpdated}
        </span>

        {/* Option B: Compact with Tooltip for space efficiency in topbar */}
        {hasFingerprints && commitHash && (
          <span
            className="pill mono"
            style={{ fontSize: "0.65rem", cursor: "help" }}
            title={`Code: ${commitHash}\nData: ${dataFingerprint || "—"}\nRun: ${runId || "—"}\nEnv: ${environment || "—"}`}
          >
            git:{commitHash.slice(0, 7)}
          </span>
        )}

        <span className={`pill ${status === "emergency" ? "risk" : "ready"}`}>
          {status === "active" ? "RUNNING" : "EMERGENCY"}
        </span>
        <button className="button" type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button
          className="button"
          type="button"
          onClick={onKill}
          style={{
            background: "linear-gradient(110deg, #b91c35, #d86024)",
          }}
        >
          KILL
        </button>
      </div>
    </header>
  );
};
