import type React from "react";
import { useState } from "react";
import { BacktestAnalysis } from "./features/BacktestAnalysis";
import { DataInspector } from "./features/DataInspector";
import { EvidenceRoom } from "./features/EvidenceRoom";
import { ResearchLog } from "./features/ResearchLog";
import { StatusBar } from "./features/StatusBar";
import { SystemHealth } from "./features/SystemHealth";
import { useDashboardData } from "./hooks/useDashboardData";

const App: React.FC = () => {
  const { alphaByDate, qualityGateByDate, verificationData, loading, refresh } =
    useDashboardData();

  const [activeTab, setActiveTab] = useState("evidence");

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  const handleKill = async () => {
    if (
      !window.confirm(
        "緊急停止（KILL SWITCH）を実行しますか？全注文がキャンセルされ、新規発注が停止されます。",
      )
    ) {
      return;
    }

    const token = (import.meta.env.VITE_API_TOKEN as string) ?? "";
    const res = await fetch("/api/kill", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => undefined);

    if (res?.ok) {
      alert("Kill signal sent successfully.");
      return;
    }
    alert("Kill signal failed. API connection or valid token required.");
  };

  if (loading && !verificationData) {
    return (
      <div
        className="loading-screen"
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--display)",
          fontSize: "1.5rem",
          color: "var(--brand)",
        }}
      >
        Loading Evidence Ledger...
      </div>
    );
  }

  const latestAlphaPayloads = Array.from(alphaByDate.values()).flat();

  return (
    <div id="app">
      <StatusBar
        status="active"
        lastUpdated={new Date().toLocaleTimeString("ja-JP")}
        commitHash={verificationData?.audit.commitHash}
        dataFingerprint={verificationData?.audit.dataFingerprint}
        runId={verificationData?.audit.runId ?? verificationData?.strategyId}
        environment={verificationData?.audit.environment}
        generatedAt={verificationData?.generatedAt}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refresh}
        onKill={handleKill}
      />

      <div style={{ marginTop: "1rem" }}>
        {activeTab === "evidence" && (
          <EvidenceRoom
            verificationData={verificationData}
            alphaDiscovery={latestAlphaPayloads}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === "inspector" && (
          <DataInspector
            verificationData={verificationData}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === "research" && (
          <ResearchLog alphaDiscovery={alphaByDate} />
        )}
        {activeTab === "health" && (
          <SystemHealth
            qualityGate={Array.from(qualityGateByDate.values())[0] || null}
            history={qualityGateByDate}
          />
        )}
        {activeTab === "backtest" && (
          <BacktestAnalysis verificationData={verificationData} />
        )}
      </div>
    </div>
  );
};

export default App;
