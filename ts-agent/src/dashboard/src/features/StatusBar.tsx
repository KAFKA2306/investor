import type React from "react";
import { TAB_IDS } from "../config";

interface StatusBarProps {
  status: "active" | "emergency";
  lastUpdated: string;
  commitHash?: string;
  dataFingerprint?: string;
  runId?: string;
  environment?: string;
  generatedAt?: string;
  activeTab: string;
  timeline: string[];
  activeDate: string;
  executionControlsAvailable: boolean;
  onTabChange: (tab: string) => void;
  onDateChange: (date: string) => void;
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
  generatedAt,
  activeTab,
  timeline,
  activeDate,
  executionControlsAvailable,
  onTabChange,
  onDateChange,
  onRefresh,
  onKill,
}) => {
  const tabs = [
    { id: TAB_IDS.EVIDENCE, label: "Overview" },
    { id: TAB_IDS.INSPECTOR, label: "Market data" },
    { id: TAB_IDS.RESEARCH, label: "Research" },
    { id: TAB_IDS.BACKTEST, label: "Validation" },
    { id: TAB_IDS.STOCKS, label: "Securities" },
    { id: TAB_IDS.HEALTH, label: "System" },
  ];

  const formatGeneratedAt = () => {
    if (!generatedAt) return "UNKNOWN";
    const parsed = new Date(generatedAt);
    if (Number.isNaN(parsed.getTime())) return generatedAt;
    return parsed.toLocaleString("ja-JP");
  };

  const evidencePublished = Boolean(generatedAt);

  return (
    <header className="topbar" aria-label="AAARTS system header">
      <div className="brand">
        <h1>AAARTS Research Console</h1>
        <p>Evidence-first investment research and validation</p>
      </div>

      <nav className="tab-nav" aria-label="Primary navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <span className={`pill ${evidencePublished ? "ready" : "risk"}`}>
          EVIDENCE: {evidencePublished ? "AVAILABLE" : "NOT PUBLISHED"}
        </span>
        <span className="pill mono" title="Data generation timestamp">
          AS OF: {formatGeneratedAt()}
        </span>
        <span id="execution-control-state" className="pill mono">
          EXECUTION: {executionControlsAvailable ? "CONTROL ENABLED" : "OBSERVE ONLY"}
        </span>

        <button className="button" type="button" onClick={onRefresh}>
          Refresh
        </button>

        <details className="audit-details">
          <summary>Audit details</summary>
          <div className="audit-panel">
            {timeline.length > 0 && (
              <label className="audit-field" htmlFor="evidence-date">
                <span>Observation</span>
                <select
                  id="evidence-date"
                  className="input-select"
                  value={activeDate}
                  onChange={(event) => onDateChange(event.target.value)}
                  aria-label="Evidence observation date"
                >
                  {timeline.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <dl className="audit-grid">
              <div>
                <dt>View refreshed</dt>
                <dd className="mono">{lastUpdated}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd className="mono">{environment || "UNKNOWN"}</dd>
              </div>
              <div>
                <dt>Run</dt>
                <dd className="mono">{runId || "UNKNOWN"}</dd>
              </div>
              <div>
                <dt>Code</dt>
                <dd className="mono">
                  {commitHash ? commitHash.slice(0, 10) : "UNKNOWN"}
                </dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd className="mono">
                  {dataFingerprint ? dataFingerprint.slice(0, 10) : "UNKNOWN"}
                </dd>
              </div>
              <div>
                <dt>Application</dt>
                <dd className="mono">
                  {status === "active" ? "AVAILABLE" : "EMERGENCY"}
                </dd>
              </div>
            </dl>

            <div className="audit-actions">
              <button
                className="button button-danger"
                type="button"
                onClick={onKill}
                disabled={!executionControlsAvailable}
                aria-describedby="execution-control-state"
                title={
                  executionControlsAvailable
                    ? "Send an emergency-stop request to the authenticated execution environment"
                    : "Execution controls are unavailable in this static deployment"
                }
              >
                Emergency stop
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
};
