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
      <div className="main" role="status" aria-live="polite">
        <div className="section-head evidence-section-head">
          <div>
            <h2>Evidence overview</h2>
            <span>Publication state and next required actions</span>
          </div>
        </div>

        <section className="panel section evidence-empty-state">
          <div className="evidence-empty-copy">
            <span className="evidence-kicker">Claims withheld</span>
            <h1 className="hero-title">No current verification artifact</h1>
            <p className="hero-subtitle">
              A current verification artifact was not published at
              {" "}
              <span className="mono">verification/standard_verification_data.json</span>.
              The console therefore does not show performance, stability, or
              readiness claims.
            </p>

            <dl className="evidence-state-list">
              <div>
                <dt>Evidence</dt>
                <dd className="risk-text">Not published</dd>
              </div>
              <div>
                <dt>Research claims</dt>
                <dd>Withheld</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>Observe only</dd>
              </div>
            </dl>

            <div className="evidence-empty-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => onNavigate?.("research")}
              >
                Review research ledger
              </button>
              <button
                type="button"
                className="button"
                onClick={() => onNavigate?.("health")}
              >
                Review system status
              </button>
            </div>
          </div>

          <aside className="publication-gate" aria-labelledby="publication-gate-title">
            <h3 id="publication-gate-title">Publication gate</h3>
            <ol className="publication-steps">
              <li>
                <span className="step-number">1</span>
                <div>
                  <strong>Generate</strong>
                  <p>Create the current verification artifact.</p>
                </div>
              </li>
              <li>
                <span className="step-number">2</span>
                <div>
                  <strong>Validate</strong>
                  <p>Pass the current schema and evidence checks.</p>
                </div>
              </li>
              <li>
                <span className="step-number">3</span>
                <div>
                  <strong>Publish provenance</strong>
                  <p>Include as-of, run, environment, code, and data identifiers.</p>
                </div>
              </li>
            </ol>
            <p className="publication-note">
              Missing evidence is displayed explicitly. Stale or synthetic results
              are not substituted.
            </p>
          </aside>
        </section>
      </div>
    );
  }

  const selectedAlpha = alphaDiscovery
    ?.flatMap((discovery) => discovery.candidates)
    .find((candidate) => candidate.status === "SELECTED");

  const dailyReturns = verificationData.strategyCum.map((cumulative, index) =>
    index === 0
      ? 0
      : cumulative /
          (verificationData.strategyCum[index - 1] ?? cumulative) -
        1,
  );

  let factorSeries = dailyReturns.map((_, index) =>
    index === 0 ? 0 : dailyReturns[index - 1],
  );
  let factorSource = "Previous-day return proxy";
  let proxySpec: ProxySpec = {
    kind: "prev_day_return",
    note: "Direct factor observations are unavailable. Previous-day return is used as an explicit proxy.",
    sourcePaths: ["strategyCum"],
  };

  if (verificationData.individualData) {
    const firstStock = Object.values(verificationData.individualData)[0];
    if (firstStock?.factors) {
      factorSeries = firstStock.factors;
      factorSource = `${firstStock.symbol} factor observations`;
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

  const hasDirectFactorEvidence = proxySpec.kind === "none";

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>Evidence overview</h2>
          <span>
            Research evidence only. No live-trading readiness is implied.
          </span>
        </div>
        <SourceBadge
          codeFingerprint={verificationData.audit.commitHash}
          dataFingerprint={verificationData.audit.dataFingerprint}
          runFingerprint={runFingerprint}
        />
      </div>

      {!hasDirectFactorEvidence && (
        <div className="panel section" role="alert">
          <strong>PROVISIONAL METRIC:</strong> Rolling IC is calculated from an
          explicit proxy because direct factor observations are unavailable.
          Source: {factorSource}.
        </div>
      )}

      <section className="hero panel hero-uqtl" aria-labelledby="strategy-title">
        <div className="hero-content">
          <div className="hero-meta">
            <span className="pill">STAGE: RESEARCH / VALIDATION</span>
            <span className="pill">
              STRATEGY: {verificationData.strategyName}
            </span>
          </div>
          <h1 id="strategy-title" className="hero-title">
            {verificationData.strategyId}
          </h1>
          <p className="hero-subtitle">{verificationData.description}</p>

          <div className="uqtl-grid" style={{ marginTop: "1.25rem" }}>
            <MetricCard
              label="Fitness"
              value={((verificationData.metrics?.fitness ?? 0) * 100).toFixed(
                1,
              )}
              unit="%"
              trend={
                (verificationData.metrics?.fitness ?? 0) > 0.7
                  ? "up"
                  : "neutral"
              }
              onClick={() => onNavigate?.("backtest")}
            />
            <MetricCard
              label="Stability"
              value={((verificationData.metrics?.stability ?? 0) * 100).toFixed(
                1,
              )}
              unit="%"
              trend={
                (verificationData.metrics?.stability ?? 0) > 0.7
                  ? "up"
                  : "neutral"
              }
            />
            <MetricCard
              label="Adoption score"
              value={((verificationData.metrics?.adoption ?? 0) * 100).toFixed(
                1,
              )}
              unit="%"
              trend={
                (verificationData.metrics?.adoption ?? 0) > 0.7
                  ? "up"
                  : "neutral"
              }
              onClick={() => onNavigate?.("research")}
            />
          </div>
        </div>

        <aside className="hero-side" aria-label="Estimated trading costs">
          <div className="panel section">
            <h3 className="quick-title">Estimated trading costs</h3>
            <div className="health-row">
              <span>Fees</span>
              <span className="pill mono">
                {formatBpsNullable(verificationData.costs?.feeBps)}
              </span>
            </div>
            <div className="health-row">
              <span>Slippage</span>
              <span className="pill mono">
                {formatBpsNullable(verificationData.costs?.slippageBps)}
              </span>
            </div>
            <div className="health-row">
              <strong>Total modeled cost</strong>
              <span className="pill mono">
                {formatBpsNullable(verificationData.costs?.totalCostBps)}
              </span>
            </div>
            <p className="quick-insight">
              Modeled costs are validation inputs, not broker execution
              evidence.
            </p>
          </div>
        </aside>
      </section>

      <div className="split">
        <section className="panel section" aria-labelledby="cumulative-title">
          <h3 id="cumulative-title" className="quick-title">
            Cumulative return
          </h3>
          <CumulativeReturnChart
            dates={verificationData.dates}
            strategyCum={verificationData.strategyCum}
            benchmarkCum={verificationData.benchmarkCum}
          />
        </section>
        <section className="panel section" aria-labelledby="rolling-ic-title">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <h3 id="rolling-ic-title" className="quick-title">
              Rolling IC — 30-day window
              {!hasDirectFactorEvidence && (
                <span style={{ color: "var(--danger)", marginLeft: "0.5rem" }}>
                  PROXY
                </span>
              )}
            </h3>
            <span className="mono" style={{ fontSize: "0.68rem" }}>
              SOURCE: {factorSource}
            </span>
          </div>
          <RollingICChart data={rollingICPoints} />
        </section>
      </div>

      <div className="section-head" style={{ marginTop: "1rem" }}>
        <h3>Candidate evidence record</h3>
        {selectedAlpha && (
          <button
            type="button"
            className="drilldown-link"
            style={{
              fontSize: "0.72rem",
              fontFamily: "var(--mono)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            onClick={() => onNavigate?.("research")}
          >
            Open candidate lineage
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
          SELECTED candidate not found for this observation date. Review the
          research log for rejection or incomplete-evidence records.
        </div>
      )}

      <section className="panel section" aria-labelledby="drawdown-title">
        <h3 id="drawdown-title" className="quick-title">
          Drawdown
        </h3>
        <DrawdownChart data={drawdownPoints} />
      </section>

      <RawDataToggle
        data={verificationData}
        fileName="verification_data.json"
      />
    </div>
  );
};
