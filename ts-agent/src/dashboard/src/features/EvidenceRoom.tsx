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
        <h2>証拠のお部屋✨</h2>
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
              label="シャープレシオ✨"
              value={verificationData.metrics?.sharpe}
              sourcePath="metrics.sharpe"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeSharpe",
                note: "年率換算のシャープレシオだよっ！",
                inputs: ["strategyCum"],
              }}
              recomputed={recomputeSharpe(dailyReturns)}
              threshold={{
                direction: "gt",
                value: 1.8,
                label: "最低ラインっ！",
              }}
              onClick={() => onNavigate?.("backtest")}
            />
            <MetricCard
              label="情報係数（IC）🔍"
              value={verificationData.metrics?.ic}
              sourcePath="metrics.ic"
              rootData={verificationData}
              resolve={resolveSourcePath}
              threshold={{
                direction: "gt",
                value: 0.04,
                label: "これくらいは欲しいなっ！",
              }}
            />
            <MetricCard
              label="最大ドローダウン📉"
              value={verificationData.metrics?.maxDD}
              unit="%"
              sourcePath="metrics.maxDD"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeMaxDD",
                note: "いちばん凹んだところだよぉ…",
                inputs: ["strategyCum", "dates"],
              }}
              recomputed={recomputeMaxDD(
                verificationData.dates,
                verificationData.strategyCum,
              )}
              threshold={{
                direction: "lt",
                value: -0.1,
                label: "ここが限界っ！",
              }}
              onClick={() => onNavigate?.("backtest")}
            />
          </div>
        </div>

        <div className="hero-side">
          <div
            className="panel section"
            style={{ background: "rgba(255,255,255,0.5)" }}
          >
            <h3 className="quick-title">コストの内訳だよっ！💸</h3>
            <div className="health-row">
              <span>お取引の手数料✨</span>
              <span className="pill">
                {formatBpsNullable(verificationData.costs?.feeBps)}
              </span>
            </div>
            <div className="health-row">
              <span>スリッページ💦</span>
              <span className="pill">
                {formatBpsNullable(verificationData.costs?.slippageBps)}
              </span>
            </div>
            <div className="health-row">
              <span>全部でこれくらいっ！</span>
              <span className="pill" style={{ fontWeight: 700 }}>
                {formatBpsNullable(verificationData.costs?.totalCostBps)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="panel section">
          <h3 className="quick-title">これまでの成績っ！📈</h3>
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
              移動IC (30日) 📐{" "}
              {proxySpec.kind !== "none" && (
                <span style={{ color: "var(--danger)" }}>📐 PROXY</span>
              )}
            </h3>
            <span style={{ fontSize: "0.6rem", color: "var(--ink-soft)" }}>
              出典：{factorSource}
            </span>
          </div>
          <RollingICChart data={rollingICPoints} />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: "1rem" }}>
        <h3>アルファ・パスポートの証明書っ！🎫</h3>
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
            }}
            onClick={() => onNavigate?.("research")}
          >
            → これまでの発見の歴史を見るっ！📜
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
          最近のログに選ばれたアルファ君がいないみたい…😢
        </div>
      )}

      <div className="panel section">
        <h3 className="quick-title">ドローダウンの推移だよっ！📉</h3>
        <DrawdownChart data={drawdownPoints} />
      </div>

      <RawDataToggle
        data={verificationData}
        fileName="verification_data.json"
      />
    </div>
  );
};
