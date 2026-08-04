import type React from "react";
import { AlphaValidationResults } from "../components/AlphaValidationResults";
import { RawDataToggle } from "../components/RawDataToggle";
import {
  collectStageMetricRows,
  formatBpsNullable,
  formatPercentNullable,
  type StandardVerificationData,
  type UnifiedLogPayload,
} from "../dashboard_core";

interface ProfessionalValidationViewProps {
  verificationData: StandardVerificationData | null;
  historicalOutcomes: Map<string, UnifiedLogPayload>;
}

export const ProfessionalValidationView: React.FC<
  ProfessionalValidationViewProps
> = ({ verificationData, historicalOutcomes }) => {
  if (!verificationData) {
    return (
      <div className="empty">
        Validation artifact unavailable. Generate standard verification data
        before reviewing performance claims.
      </div>
    );
  }

  const historyRows = Array.from(historicalOutcomes.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .flatMap(([date, payload]) =>
      collectStageMetricRows(payload).map((row) => ({
        date,
        stage: row.stage,
        status: row.status,
        metric: row.key,
        value: row.value,
      })),
    );

  const strategyStart = verificationData.strategyCum[0];
  const strategyEnd = verificationData.strategyCum.at(-1);
  const benchmarkStart = verificationData.benchmarkCum[0];
  const benchmarkEnd = verificationData.benchmarkCum.at(-1);
  const strategyReturn =
    strategyStart !== undefined &&
    strategyEnd !== undefined &&
    strategyStart !== 0
      ? strategyEnd / strategyStart - 1
      : undefined;
  const benchmarkReturn =
    benchmarkStart !== undefined &&
    benchmarkEnd !== undefined &&
    benchmarkStart !== 0
      ? benchmarkEnd / benchmarkStart - 1
      : undefined;

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>Validation</h2>
          <span>
            Backtest metrics, modeled costs, benchmark comparison, and metric
            gates
          </span>
        </div>
        <span className="pill mono">
          SCHEMA: {verificationData.schemaVersion}
        </span>
      </div>

      <section className="panel section" aria-label="Validation scope">
        <div className="section-head">
          <h3>Scope and identity</h3>
          <span>Research artifact</span>
        </div>
        <div className="uqtl-grid">
          <div className="kpi-card">
            <div className="label">Strategy</div>
            <div className="value mono">{verificationData.strategyId}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Observations</div>
            <div className="value mono">{verificationData.dates.length}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Environment</div>
            <div className="value mono">
              {verificationData.audit.environment}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Run ID</div>
            <div className="value mono">
              {verificationData.audit.runId || "UNKNOWN"}
            </div>
          </div>
        </div>
        <p className="quick-insight">
          The dashboard does not infer frozen-OOS, paper-trading, or live
          execution evidence unless those artifacts are separately present.
        </p>
      </section>

      <section className="panel section" aria-label="Metric gate results">
        <div className="section-head">
          <h3>Metric gate</h3>
          <span>Threshold evaluation only</span>
        </div>
        <AlphaValidationResults verificationData={verificationData} />
      </section>

      <div className="split">
        <section
          className="panel section table-wrap"
          aria-label="Performance metrics"
        >
          <div className="section-head">
            <h3>Performance metrics</h3>
            <span>Recorded or derived from the verification artifact</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Evidence class</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Strategy cumulative return</td>
                <td className="mono">{formatPercentNullable(strategyReturn)}</td>
                <td>Derived from strategyCum</td>
              </tr>
              <tr>
                <td>Benchmark cumulative return</td>
                <td className="mono">
                  {formatPercentNullable(benchmarkReturn)}
                </td>
                <td>Derived from benchmarkCum</td>
              </tr>
              <tr>
                <td>Recorded total return</td>
                <td className="mono">
                  {formatPercentNullable(
                    verificationData.metrics?.totalReturn,
                  )}
                </td>
                <td>Recorded metric</td>
              </tr>
              <tr>
                <td>Sharpe ratio</td>
                <td className="mono">
                  {verificationData.metrics?.sharpe?.toFixed(3) ?? "MISSING"}
                </td>
                <td>Recorded metric</td>
              </tr>
              <tr>
                <td>Information coefficient</td>
                <td className="mono">
                  {verificationData.metrics?.ic?.toFixed(3) ?? "MISSING"}
                </td>
                <td>Recorded metric</td>
              </tr>
              <tr>
                <td>Maximum drawdown</td>
                <td className="mono">
                  {formatPercentNullable(verificationData.metrics?.maxDD)}
                </td>
                <td>Recorded metric</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          className="panel section table-wrap"
          aria-label="Modeled costs"
        >
          <div className="section-head">
            <h3>Modeled trading costs</h3>
            <span>Not broker fill evidence</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cost</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fees</td>
                <td className="mono">
                  {formatBpsNullable(verificationData.costs?.feeBps)}
                </td>
              </tr>
              <tr>
                <td>Slippage</td>
                <td className="mono">
                  {formatBpsNullable(verificationData.costs?.slippageBps)}
                </td>
              </tr>
              <tr>
                <td>Total modeled cost</td>
                <td className="mono">
                  {formatBpsNullable(verificationData.costs?.totalCostBps)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section
        className="panel section table-wrap"
        aria-label="Historical validation metrics"
      >
        <div className="section-head">
          <h3>Historical stage metrics</h3>
          <span>Most recent observations first</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {historyRows.slice(0, 200).map((row, index) => (
              <tr key={`${row.date}-${row.stage}-${row.metric}-${index}`}>
                <td className="mono">{row.date}</td>
                <td>{row.stage}</td>
                <td>{row.status}</td>
                <td>{row.metric}</td>
                <td className="mono">
                  {row.value === undefined
                    ? "MISSING"
                    : row.value.toFixed(6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {historyRows.length === 0 && (
          <div className="empty" style={{ marginTop: "0.75rem" }}>
            No historical unified-stage metrics are available.
          </div>
        )}
      </section>

      <RawDataToggle
        data={verificationData}
        fileName="validation_artifact.json"
      />
    </div>
  );
};
