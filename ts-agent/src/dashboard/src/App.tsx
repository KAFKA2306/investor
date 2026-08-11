import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { TAB_IDS } from "./config";
import { EvidenceRoom } from "./features/EvidenceRoom";
import { ProfessionalDataInspector } from "./features/ProfessionalDataInspector";
import { ProfessionalResearchLog } from "./features/ProfessionalResearchLog";
import { ProfessionalSecuritiesView } from "./features/ProfessionalSecuritiesView";
import { ProfessionalSystemHealth } from "./features/ProfessionalSystemHealth";
import { ProfessionalValidationView } from "./features/ProfessionalValidationView";
import { StatusBar } from "./features/StatusBar";
import { useDashboardData } from "./hooks/useDashboardData";

const RELEASE = "kafka-signal-v1.0.0";

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

  const knownTabs = useMemo(() => new Set<string>(Object.values(TAB_IDS)), []);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested && knownTabs.has(requested) ? requested : TAB_IDS.EVIDENCE;
  });

  useEffect(() => {
    const requestedDate = new URLSearchParams(window.location.search).get(
      "date",
    );
    if (requestedDate && requestedDate !== activeDate)
      setActiveDate(requestedDate);
  }, [activeDate, setActiveDate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (activeDate) params.set("date", activeDate);
    else params.delete("date");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`,
    );
  }, [activeDate, activeTab]);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab && knownTabs.has(tab)) setActiveTab(tab);
      const date = params.get("date");
      if (date) setActiveDate(date);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [knownTabs, setActiveDate]);

  // Public GitHub Pages is an observation surface. Execution controls must be
  // explicitly enabled for a separately authenticated deployment.
  // @ts-expect-error - ImportMeta env typing is supplied by Vite at build time.
  const executionControlsAvailable =
    (import.meta.env.VITE_ENABLE_EXECUTION_CONTROLS as string | undefined) ===
    "true";

  const handleNavigate = (tab: string) => setActiveTab(tab);

  const handleKill = async () => {
    if (!executionControlsAvailable) {
      alert(
        "この静的デプロイでは執行制御を利用できません。認証済みの運用環境を使用してください。",
      );
      return;
    }
    if (
      !window.confirm(
        "緊急停止を実行します。新規発注を停止し、キャンセル可能な注文の取消要求を送信します。続行しますか？",
      )
    ) {
      return;
    }

    // @ts-expect-error - ImportMeta env typing is supplied by Vite at build time.
    const token = (import.meta.env.VITE_API_TOKEN as string) ?? "";
    const res = await fetch("/api/kill", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => undefined);
    if (res?.ok) {
      alert("緊急停止要求を送信しました。運用環境の状態を確認してください。");
      return;
    }
    alert(
      "緊急停止要求を送信できませんでした。API接続、認証、運用環境を確認してください。",
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
          fontFamily: "var(--sans)",
          fontSize: "1rem",
          color: "var(--ink)",
          background: "var(--bg)",
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <output>証拠台帳と検証データを読み込んでいます</output>
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
        executionControlsAvailable={executionControlsAvailable}
        onTabChange={setActiveTab}
        onDateChange={setActiveDate}
        onRefresh={refresh}
        onKill={handleKill}
      />

      <main style={{ marginTop: "1rem" }}>
        {activeTab === TAB_IDS.EVIDENCE && (
          <EvidenceRoom
            verificationData={verificationData}
            alphaDiscovery={activeAlphaPayloads}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === TAB_IDS.INSPECTOR && (
          <ProfessionalDataInspector verificationData={verificationData} />
        )}
        {activeTab === TAB_IDS.RESEARCH && (
          <ProfessionalResearchLog
            alphaDiscovery={alphaByDate}
            activeDate={activeDate}
            onSelectDate={setActiveDate}
          />
        )}
        {activeTab === TAB_IDS.HEALTH && (
          <ProfessionalSystemHealth
            qualityGate={activeQualityGate}
            history={qualityGateByDate}
          />
        )}
        {activeTab === TAB_IDS.BACKTEST && (
          <ProfessionalValidationView
            verificationData={verificationData}
            historicalOutcomes={unifiedByDate}
          />
        )}
        {activeTab === TAB_IDS.STOCKS && (
          <ProfessionalSecuritiesView verificationData={verificationData} />
        )}
      </main>
      <p className="kafka-signal-build">KAFKA SIGNAL {RELEASE} · 6cceef70</p>
    </div>
  );
};

export default App;
