import type React from "react";
import { AlphaPassportCard } from "../components/AlphaPassportCard";
import { CumulativeReturnChart } from "../components/CumulativeReturnChart";
import { DrawdownChart } from "../components/DrawdownChart";
import { MetricCard } from "../components/MetricCard";
import { RawDataToggle } from "../components/RawDataToggle";
import { RollingICChart } from "../components/RollingICChart";
import { SourceBadge } from "../components/SourceBadge";
import {
  type AlphaDiscoveryPayload,
  computeDrawdownSeries,
  computeRollingIC,
  formatBpsNullable,
  type ProxySpec,
  recomputeMaxDD,
  recomputeSharpe,
  resolveSourcePath,
  type StandardVerificationData,
} from "../dashboard_core";

interface EvidenceRoomProps {
  verificationData: StandardVerificationData | null;
  alphaDiscovery: AlphaDiscoveryPayload[] | null;
  onNavigate?: (page: string) => void;
}

export const EvidenceRoom: React.FC<EvidenceRoomProps> = ({
  verificationData,
  alphaDiscovery,
  onNavigate,
}) => {
  if (!verificationData) {
    return (
      <div className="empty">
        検証データが見つからないよぉ…バックテストを先にやってみてねっ！🎀
      </div>
    );
  }

  // Find the selected alpha candidate if any
  const selectedAlpha = alphaDiscovery
    ?.flatMap((d) => d.candidates)
    .find((c) => c.status === "SELECTED");

  // Prepare Rolling IC data
  const dailyReturns = verificationData.strategyCum.map((c, i) =>
    i === 0 ? 0 : c / (verificationData.strategyCum[i - 1] ?? c) - 1,
  );

  // Try to find a factor series in individualData if available, otherwise use lagged return as proxy
  let factorSeries = dailyReturns.map((_, i) =>
    i === 0 ? 0 : dailyReturns[i - 1],
  );
  let factorSource = "遅延リターン（プロキシだよっ！✨）";
  let proxySpec: ProxySpec = {
    kind: "prev_day_return",
    note: "本物のファクターが見つからないから、昨日のリターンを代わりにするねっ！💖",
    sourcePaths: ["strategyCum"],
  };

  if (verificationData.individualData) {
    const firstStock = Object.values(verificationData.individualData)[0];
    if (firstStock?.factors) {
      factorSeries = firstStock.factors;
      factorSource = `${firstStock.symbol} からのファクターだよっ！`;
      proxySpec = { kind: "none" };
    }
  }

  const rollingICPoints = computeRollingIC(
    verificationData.dates,
    factorSeries,
    dailyReturns,
    30,
    proxySpec,
  );

  const drawdownPoints = computeDrawdownSeries(
    verificationData.dates,
    verificationData.strategyCum,
  );

  const runFingerprint = {
    runId: verificationData.audit.runId ?? "unknown",
    startedAt: verificationData.generatedAt,
    environment: verificationData.audit.environment,
  };

  return (
    <div className="main">
      <div className="section-head">
        <h2>証拠の部屋 🏛️✨</h2>
        <SourceBadge
          codeFingerprint={verificationData.audit.commitHash}
          dataFingerprint={verificationData.audit.dataFingerprint}
          runFingerprint={runFingerprint}
        />
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <div className="hero-meta">
            <span className="pill">戦略：{verificationData.strategyName}</span>
          </div>
          <h1 className="hero-title">{verificationData.strategyId}</h1>
          <p className="hero-subtitle">{verificationData.description}</p>

          <div className="uqtl-grid" style={{ marginTop: "1.5rem" }}>
            <MetricCard
              label="シャープレシオ (Sharpe) 💎"
              value={verificationData.metrics?.sharpe ?? 0}
              sourcePath="metrics.sharpe"
              derivation={{
                id: "recomputeSharpe",
                note: "年率換算のシャープレシオだよっ！",
                inputs: ["strategyCum"],
              }}
              trend={recomputeSharpe(dailyReturns) >= 0 ? "up" : "down"}
              onClick={() => onNavigate?.("backtest")}
            />
            <MetricCard
              label="情報係数 (IC) 🔍"
              value={verificationData.metrics?.ic ?? 0}
              sourcePath="metrics.ic"
              trend="neutral"
            />
            <MetricCard
              label="最大ドローダウン (MaxDD) 📉"
              value={(verificationData.metrics?.maxDD ?? 0) * 100}
              unit="%"
              sourcePath="metrics.maxDD"
              derivation={{
                id: "recomputeMaxDD",
                note: "いちばん凹んだところだよぉ…",
                inputs: ["strategyCum", "dates"],
              }}
              trend="down"
              onClick={() => onNavigate?.("backtest")}
            />
          </div>
        </div>

        <div className="hero-side">
          <div
            className="panel section"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--line)",
            }}
          >
            <h3
              className="quick-title"
              style={{
                fontSize: "0.75rem",
                fontWeight: "bold",
                borderBottom: "1px solid var(--line)",
                paddingBottom: "0.4rem",
                marginBottom: "0.8rem",
              }}
            >
              運用コストの内訳 💸
            </h3>
            <div
              className="health-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.4rem",
                fontSize: "0.75rem",
              }}
            >
              <span style={{ color: "var(--ink-soft)" }}>売買手数料 (Bps)</span>
              <span className="pill" style={{ fontFamily: "var(--mono)" }}>
                {formatBpsNullable(verificationData.costs?.feeBps)}
              </span>
            </div>
            <div
              className="health-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.4rem",
                fontSize: "0.75rem",
              }}
            >
              <span style={{ color: "var(--ink-soft)" }}>推定スリッページ</span>
              <span className="pill" style={{ fontFamily: "var(--mono)" }}>
                {formatBpsNullable(verificationData.costs?.slippageBps)}
              </span>
            </div>
            <div
              className="health-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "0.4rem",
                borderTop: "1px dashed var(--line)",
                fontSize: "0.8rem",
                fontWeight: "bold",
              }}
            >
              <span>合計コスト</span>
              <span
                className="pill"
                style={{
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }}
              >
                {formatBpsNullable(verificationData.costs?.totalCostBps)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="panel section">
          <h3 className="quick-title">資産推移の履歴 📈</h3>
          <CumulativeReturnChart
            dates={verificationData.dates}
            strategyCum={verificationData.strategyCum}
            benchmarkCum={verificationData.benchmarkCum}
          />
        </div>
        <div className="panel section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h3 className="quick-title">
              移動IC推移 (30日窓) 📐{" "}
              {proxySpec.kind !== "none" && (
                <span style={{ color: "var(--danger)", fontSize: "0.6rem" }}>
                  [PROXY使用中]
                </span>
              )}
            </h3>
            <span style={{ fontSize: "0.6rem", color: "var(--ink-soft)" }}>
              ソース：{factorSource}
            </span>
          </div>
          <RollingICChart data={rollingICPoints} />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: "1rem" }}>
        <h3>アルファ・パスポート鑑定書 🎫✨</h3>
        {selectedAlpha && (
          <button
            type="button"
            className="drilldown-link"
            style={{
              fontSize: "0.7rem",
              fontFamily: "var(--mono)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--brand)",
            }}
            onClick={() => onNavigate?.("research")}
          >
            → 発見の歴史（タイムライン）を見るっ！📜
          </button>
        )}
      </div>

      {selectedAlpha ? (
        <AlphaPassportCard
          id={selectedAlpha.id}
          description={selectedAlpha.description}
          reasoning={selectedAlpha.reasoning}
          scores={selectedAlpha.scores}
          status={selectedAlpha.status}
          featureSignature={selectedAlpha.featureSignature}
          ast={selectedAlpha.ast}
        />
      ) : (
        <div className="panel section empty">
          現在、このセッションで採択されたアルファは見つかりませんでした😢
        </div>
      )}

      <div className="panel section">
        <h3 className="quick-title">最大ドローダウンの推移 📉</h3>
        <DrawdownChart data={drawdownPoints} />
      </div>

      <RawDataToggle
        data={verificationData}
        fileName="verification_data.json"
      />
    </div>
  );
};
