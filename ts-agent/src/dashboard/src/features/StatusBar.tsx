import type React from "react";
import { SourceBadge } from "../components/SourceBadge";

interface StatusBarProps {
  status: "active" | "emergency";
  lastUpdated: string;
  commitHash?: string;
  dataFingerprint?: string;
  runId?: string;
  environment?: string;
  generatedAt?: string;
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
  generatedAt,
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

        {/* TODO(human): 3指紋セット（code/data/run）をトップバーの限られたスペースにどう配置するか？
            以下の hasFingerprints ブロックを実装してください。
            選択肢:
            A) SourceBadge をそのままインライン表示（幅を取るがデータ豊富）
            B) commit hashのみpillで表示 + hoverでツールチップに残り2指紋
            C) "🔍 Fingerprints" ボタンで展開/折り畳み
            考慮事項: スクリーン幅 < 1220px ではトップバーが縦積みになる。
            実装場所: hasFingerprints ブロック内（下記）。 */}
        {hasFingerprints && commitHash && (
          <SourceBadge
            codeFingerprint={commitHash}
            dataFingerprint={dataFingerprint}
            runFingerprint={{
              runId: runId ?? "—",
              startedAt: generatedAt ?? new Date().toISOString(),
              environment: environment ?? "unknown",
            }}
          />
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
