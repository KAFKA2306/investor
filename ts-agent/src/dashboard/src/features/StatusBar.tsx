import type React from "react";

interface StatusBarProps {
  status: "active" | "emergency";
  lastUpdated: string;
  onRefresh: () => void;
  onKill: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  lastUpdated,
  onRefresh,
  onKill,
}) => {
  return (
    <header className="topbar panel">
      <div className="brand">
        <h1>Hypothesis Evolution Ledger</h1>
        <p>Visual Proof + Immutable Evidence + Execution Reality</p>
      </div>

      <div className="topbar-right">
        <span className={`pill ${status === "emergency" ? "risk" : "ready"}`}>
          システム状態: {status === "active" ? "稼働中" : "緊急停止中"}
        </span>
        <span id="sync-label" className="pill">
          最終更新: {lastUpdated}
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
            boxShadow: "0 10px 20px -14px rgba(185, 28, 53, 0.8)",
          }}
        >
          KILL SWITCH
        </button>
      </div>
    </header>
  );
};
