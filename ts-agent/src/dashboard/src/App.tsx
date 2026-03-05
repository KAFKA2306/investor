import type React from "react";
import { useState } from "react";
import { TAB_IDS } from "./config";
import { BacktestAnalysis } from "./features/BacktestAnalysis";
import { DataInspector } from "./features/DataInspector";
import { EvidenceRoom } from "./features/EvidenceRoom";
import { ResearchLog } from "./features/ResearchLog";
import { StatusBar } from "./features/StatusBar";
import { StockAnalysis } from "./features/StockAnalysis";
import { SystemHealth } from "./features/SystemHealth";
import { useDashboardData } from "./hooks/useDashboardData";

const App: React.FC = () => {
  const {
    alphaByDate,
    qualityGateByDate,
    unifiedByDate,
    verificationData,
    timeline,
    activeDate,
    setActiveDate,
    loading,
    refresh,
  } = useDashboardData();

  const [activeTab, setActiveTab] = useState(TAB_IDS.EVIDENCE);

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

    // @ts-expect-error - ImportMeta type issue in this env
    const token = (import.meta.env.VITE_API_TOKEN as string) ?? "";
    const res = await fetch("/api/kill", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => undefined);

    if (res?.ok) {
      alert("緊急停止シグナルを送信しました。全プロセスを終了します。");
      return;
    }
    alert(
      "緊急停止に失敗しました。APIサーバーの接続状態か、認証トークンを確認してください。",
    );
  };

  if (loading && !verificationData && timeline.length === 0) {
    return (
      <div
        className="loading-screen"
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--display)",
          fontSize: "1.2rem",
          color: "var(--brand)",
          background: "var(--bg-panel)",
        }}
      >
        <div className="spinner" />
        証拠台帳 (Evidence Ledger) を読み込み中だよぉ…✨
      </div>
    );
  }

  const activeAlphaPayloads = activeDate
    ? (alphaByDate.get(activeDate) ?? [])
    : [];
  const activeQualityGate = activeDate
    ? (qualityGateByDate.get(activeDate) ?? null)
    : null;

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
        timeline={timeline}
        activeDate={activeDate}
        onTabChange={setActiveTab}
        onDateChange={setActiveDate}
        onRefresh={refresh}
        onKill={handleKill}
      />

      <div style={{ marginTop: "1rem" }}>
        {activeTab === TAB_IDS.EVIDENCE && (
          <EvidenceRoom
            verificationData={verificationData}
            alphaDiscovery={activeAlphaPayloads}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === TAB_IDS.INSPECTOR && (
          <DataInspector verificationData={verificationData} />
        )}
        {activeTab === TAB_IDS.RESEARCH && (
          <ResearchLog
            alphaDiscovery={alphaByDate}
            activeDate={activeDate}
            onSelectDate={setActiveDate}
          />
        )}
        {activeTab === TAB_IDS.HEALTH && (
          <SystemHealth
            qualityGate={activeQualityGate}
            history={qualityGateByDate}
          />
        )}
        {activeTab === TAB_IDS.BACKTEST && (
          <BacktestAnalysis
            verificationData={verificationData}
            historicalOutcomes={unifiedByDate}
          />
        )}
        {activeTab === TAB_IDS.STOCKS && (
          <StockAnalysis verificationData={verificationData} />
        )}
      </div>
    </div>
  );
};

export default App;
