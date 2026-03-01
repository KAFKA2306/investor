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
        No verification data available. Run backtest first.
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
  let factorSource = "Lagged Return (Proxy)";
  let proxySpec: ProxySpec = {
    kind: "prev_day_return",
    note: "True factor series unavailable; using lagged daily return as proxy",
    sourcePaths: ["strategyCum"],
  };

  if (verificationData.individualData) {
    const firstStock = Object.values(verificationData.individualData)[0];
    if (firstStock?.factors) {
      factorSeries = firstStock.factors;
      factorSource = `Factor from ${firstStock.symbol}`;
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
        <h2>Evidence Room</h2>
        <SourceBadge
          codeFingerprint={verificationData.audit.commitHash}
          dataFingerprint={verificationData.audit.dataFingerprint}
          runFingerprint={runFingerprint}
        />
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <div className="hero-meta">
            <span className="pill">
              Strategy: {verificationData.strategyName}
            </span>
          </div>
          <h1 className="hero-title">{verificationData.strategyId}</h1>
          <p className="hero-subtitle">{verificationData.description}</p>

          <div className="uqtl-grid" style={{ marginTop: "1.5rem" }}>
            <MetricCard
              label="Sharpe Ratio"
              value={verificationData.metrics?.sharpe}
              sourcePath="metrics.sharpe"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeSharpe",
                note: "Annualized Sharpe Ratio",
                inputs: ["strategyCum"],
              }}
              recomputed={recomputeSharpe(dailyReturns)}
              threshold={{ direction: "gt", value: 1.8, label: "Min Sharpe" }}
              onClick={() => onNavigate?.("backtest")}
            />
            <MetricCard
              label="Information Coef."
              value={verificationData.metrics?.ic}
              sourcePath="metrics.ic"
              rootData={verificationData}
              resolve={resolveSourcePath}
              threshold={{ direction: "gt", value: 0.04, label: "Min IC" }}
            />
            <MetricCard
              label="Max Drawdown"
              value={verificationData.metrics?.maxDD}
              unit="%"
              sourcePath="metrics.maxDD"
              rootData={verificationData}
              resolve={resolveSourcePath}
              derivation={{
                id: "recomputeMaxDD",
                note: "Maximum peak-to-trough decline",
                inputs: ["strategyCum", "dates"],
              }}
              recomputed={recomputeMaxDD(
                verificationData.dates,
                verificationData.strategyCum,
              )}
              threshold={{
                direction: "lt",
                value: -0.1,
                label: "Max DD Limit",
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
            <h3 className="quick-title">Cost Breakdown</h3>
            <div className="health-row">
              <span>Trading Fee</span>
              <span className="pill">
                {formatBpsNullable(verificationData.costs?.feeBps)}
              </span>
            </div>
            <div className="health-row">
              <span>Slippage</span>
              <span className="pill">
                {formatBpsNullable(verificationData.costs?.slippageBps)}
              </span>
            </div>
            <div className="health-row">
              <span>Total Cost</span>
              <span className="pill" style={{ fontWeight: 700 }}>
                {formatBpsNullable(verificationData.costs?.totalCostBps)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="panel section">
          <h3 className="quick-title">Cumulative Performance</h3>
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
              Rolling IC (30D){" "}
              {proxySpec.kind !== "none" && (
                <span style={{ color: "var(--danger)" }}>📐 PROXY</span>
              )}
            </h3>
            <span style={{ fontSize: "0.6rem", color: "var(--ink-soft)" }}>
              Source: {factorSource}
            </span>
          </div>
          <RollingICChart data={rollingICPoints} />
        </div>
      </div>

      <div className="section-head" style={{ marginTop: "1rem" }}>
        <h3>Alpha Passport Proof</h3>
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
            → View Full Discovery History
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
          No selected alpha candidate found in recent logs.
        </div>
      )}

      <div className="panel section">
        <h3 className="quick-title">Performance Drawdown</h3>
        <DrawdownChart data={drawdownPoints} />
      </div>

      <RawDataToggle
        data={verificationData}
        fileName="verification_data.json"
      />
    </div>
  );
};
