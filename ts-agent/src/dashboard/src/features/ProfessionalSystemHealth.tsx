import type React from "react";
import { RawDataToggle } from "../components/RawDataToggle";
import { chipClass, type QualityGatePayload } from "../dashboard_core";

interface ProfessionalSystemHealthProps {
  qualityGate: QualityGatePayload | null;
  history: Map<string, QualityGatePayload>;
}

export const ProfessionalSystemHealth: React.FC<
  ProfessionalSystemHealthProps
> = ({ qualityGate, history }) => {
  if (!qualityGate) {
    return (
      <div className="empty">
        Quality-gate artifact unavailable. Generate the system quality report
        before interpreting readiness.
      </div>
    );
  }

  const providers = Object.entries(qualityGate.connectivity);
  const components = Object.entries(qualityGate.components).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const historyRows = Array.from(history.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>System status</h2>
          <span>
            Connectivity, quality-gate inputs, and historical verdicts
          </span>
        </div>
        <span className={`pill ${chipClass(qualityGate.verdict)}`}>
          QUALITY GATE: {qualityGate.verdict}
        </span>
      </div>

      <section className="panel section" aria-label="Current quality gate">
        <div className="uqtl-grid">
          <div className="kpi-card">
            <div className="label">Score</div>
            <div className="value mono">{qualityGate.score.toFixed(1)}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Verdict</div>
            <div className="value mono">{qualityGate.verdict}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Generated at</div>
            <div className="value mono">
              {new Date(qualityGate.generatedAt).toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Evidence inputs</div>
            <div className="value mono">{qualityGate.derivedFrom.length}</div>
          </div>
        </div>
        <p className="quick-insight">
          This quality gate summarizes configured checks. It does not establish
          live execution availability or investment performance.
        </p>
      </section>

      <div className="split">
        <section
          className="panel section table-wrap"
          aria-label="Provider connectivity"
        >
          <div className="section-head">
            <h3>Provider connectivity</h3>
            <span>Current report</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Observed detail</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(([provider, detail]) => {
                const normalized = detail as {
                  status: string;
                  listedCount?: number;
                  hasStatsData?: boolean;
                };
                const observedDetail =
                  normalized.listedCount !== undefined
                    ? `listedCount=${normalized.listedCount}`
                    : normalized.hasStatsData !== undefined
                      ? `hasStatsData=${String(normalized.hasStatsData)}`
                      : "No additional detail";
                return (
                  <tr key={provider}>
                    <td>{provider}</td>
                    <td>
                      <span className={`pill ${chipClass(normalized.status)}`}>
                        {normalized.status}
                      </span>
                    </td>
                    <td className="mono">{observedDetail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section
          className="panel section table-wrap"
          aria-label="Quality components"
        >
          <div className="section-head">
            <h3>Quality components</h3>
            <span>Configured component scores</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {components.map(([component, score]) => (
                <tr key={component}>
                  <td>{component}</td>
                  <td className="mono">{score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section
        className="panel section table-wrap"
        aria-label="Quality gate history"
      >
        <div className="section-head">
          <h3>Quality-gate history</h3>
          <span>Most recent reports first</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Observation</th>
              <th>Generated at</th>
              <th>Verdict</th>
              <th>Score</th>
              <th>Evidence inputs</th>
            </tr>
          </thead>
          <tbody>
            {historyRows.map(([date, gate]) => (
              <tr key={`${date}-${gate.generatedAt}`}>
                <td className="mono">{date}</td>
                <td className="mono">
                  {new Date(gate.generatedAt).toLocaleString("ja-JP")}
                </td>
                <td>
                  <span className={`pill ${chipClass(gate.verdict)}`}>
                    {gate.verdict}
                  </span>
                </td>
                <td className="mono">{gate.score.toFixed(1)}</td>
                <td className="mono">{gate.derivedFrom.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel section" aria-label="Evidence sources">
        <div className="section-head">
          <h3>Derived from</h3>
          <span>Input identifiers recorded by the quality gate</span>
        </div>
        <ul>
          {qualityGate.derivedFrom.map((source) => (
            <li key={source} className="mono">
              {source}
            </li>
          ))}
        </ul>
      </section>

      <RawDataToggle data={qualityGate} fileName="quality_gate.json" />
    </div>
  );
};
