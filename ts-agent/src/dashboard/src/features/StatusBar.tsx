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
        {timeline.length > 0 && (
          <label className="pill" htmlFor="evidence-date">
            <span className="mono">Observation</span>
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

        <span className="pill mono" title="Data generation timestamp">
          DATA AS OF: {formatGeneratedAt()}
        </span>
        <span className="pill mono" title="Browser refresh timestamp">
          VIEW: {lastUpdated}
        </span>
        <span className="pill mono">ENV: {environment || "UNKNOWN"}</span>
        <span className="pill mono">RUN: {runId || "UNKNOWN"}</span>
        <span className="pill mono">
          CODE: {commitHash ? commitHash.slice(0, 10) : "UNKNOWN"}
        </span>
        <span className="pill mono">
          DATA: {dataFingerprint ? dataFingerprint.slice(0, 10) : "UNKNOWN"}
        </span>
        <span className={`pill ${status === "emergency" ? "risk" : "ready"}`}>
          {status === "active" ? "SYSTEM: OPERATIONAL" : "SYSTEM: EMERGENCY"}
        </span>

        <button className="button" type="button" onClick={onRefresh}>
          Refresh data
        </button>

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
        <span id="execution-control-state" className="pill mono">
          EXECUTION: {executionControlsAvailable ? "CONTROL ENABLED" : "OBSERVE ONLY"}
        </span>
      </div>
    </header>
  );
};
