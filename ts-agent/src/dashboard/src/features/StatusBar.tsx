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
  activeTab,
  timeline,
  activeDate,
  onTabChange,
  onDateChange,
  onRefresh,
  onKill,
}) => {
  const tabs = [
    { id: TAB_IDS.EVIDENCE, label: "証拠のお部屋✨" },
    { id: TAB_IDS.INSPECTOR, label: "データ調査しちゃうもんっ！🔍" },
    { id: TAB_IDS.RESEARCH, label: "研究のきろくっ！📝" },
    { id: TAB_IDS.HEALTH, label: "システムの健康診断🏥" },
    { id: TAB_IDS.BACKTEST, label: "解析するよっ！📊" },
    { id: TAB_IDS.STOCKS, label: "銘柄分析📈" },
  ];

  const hasFingerprints = Boolean(commitHash);

  return (
    <header
      className="topbar panel"
      style={{ flexWrap: "wrap", gap: "0.5rem" }}
    >
      <div className="brand">
        <h1>アルファ進化ダッシュボード 💎</h1>
        <p>視覚的な証明 ＋ 改ざんできない証拠だよっ！✨</p>
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
        {timeline.length > 0 && (
          <div
            className="pill"
            style={{
              padding: "0.2rem 0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              border: "1px solid var(--brand-soft)",
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                textTransform: "uppercase",
                fontWeight: "bold",
              }}
            >
              Time Machine 🕰️
            </span>
            <select
              className="input-select"
              value={activeDate}
              onChange={(e) => onDateChange(e.target.value)}
              style={{
                fontSize: "0.7rem",
                padding: "2px 4px",
                border: "none",
                background: "transparent",
                color: "var(--brand)",
                fontWeight: "bold",
              }}
            >
              {timeline.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
        )}

        <span
          className="pill mono"
          style={{ fontSize: "0.65rem", border: "1px solid var(--line)" }}
        >
          最終更新：{lastUpdated}
        </span>

        {/* Option B: Compact with Tooltip for space efficiency in topbar */}
        {hasFingerprints && commitHash && (
          <span
            className="pill mono"
            style={{
              fontSize: "0.65rem",
              cursor: "help",
              border: "1px solid var(--line)",
            }}
            title={`Code: ${commitHash}\nData: ${dataFingerprint || "—"}\nRun: ${runId || "—"}\nEnv: ${environment || "—"}`}
          >
            git:{commitHash.slice(0, 7)}
          </span>
        )}

        <span
          className={`pill ${status === "emergency" ? "risk" : "ready"}`}
          style={{ fontWeight: "bold" }}
        >
          {status === "active" ? "正常稼働中っ！✨" : "緊急事態発生っ！🚨"}
        </span>
        <button className="button" type="button" onClick={onRefresh}>
          最新に更新🔃
        </button>
        <button
          className="button"
          type="button"
          onClick={onKill}
          style={{
            background: "linear-gradient(110deg, #b91c35, #d86024)",
            fontWeight: "bold",
          }}
        >
          全システム停止っ！💥
        </button>
      </div>
    </header>
  );
};
