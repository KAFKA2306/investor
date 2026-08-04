import type React from "react";
import { useMemo, useState } from "react";
import { RawDataToggle } from "../components/RawDataToggle";
import type { StandardVerificationData } from "../dashboard_core";

interface ProfessionalDataInspectorProps {
  verificationData: StandardVerificationData | null;
}

export const ProfessionalDataInspector: React.FC<
  ProfessionalDataInspectorProps
> = ({ verificationData }) => {
  const symbols = useMemo(
    () =>
      verificationData?.individualData
        ? Object.keys(verificationData.individualData).sort()
        : [],
    [verificationData],
  );
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const activeSymbol = selectedSymbol || symbols[0] || "";
  const stockData = verificationData?.individualData?.[activeSymbol];

  const observations = useMemo(() => {
    if (!stockData) return [];
    return stockData.dates
      .map((date, index) => ({
        date,
        price: stockData.prices[index],
        factor: stockData.factors[index],
        position: stockData.positions[index],
      }))
      .reverse();
  }, [stockData]);

  const latestCrossSection = useMemo(() => {
    if (!verificationData?.individualData) return [];
    return Object.entries(verificationData.individualData)
      .map(([symbol, data]) => {
        const index = data.dates.length - 1;
        return {
          symbol,
          date: data.dates[index] ?? "UNKNOWN",
          price: data.prices[index],
          factor: data.factors[index],
          position: data.positions[index],
          observations: data.dates.length,
        };
      })
      .sort((a, b) => Math.abs(b.position ?? 0) - Math.abs(a.position ?? 0));
  }, [verificationData]);

  if (!verificationData?.individualData || symbols.length === 0) {
    return (
      <div className="empty">
        Individual security observations are unavailable in the current
        verification artifact.
      </div>
    );
  }

  const latest = observations[0];

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>Market data inspector</h2>
          <span>Observed prices, factor values, positions, and dataset scope</span>
        </div>
        <span className="pill mono">SYMBOLS: {symbols.length}</span>
      </div>

      <section className="panel section" aria-label="Dataset identity">
        <div className="uqtl-grid">
          <div className="kpi-card">
            <div className="label">Schema</div>
            <div className="value mono">{verificationData.schemaVersion}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Generated at</div>
            <div className="value mono">
              {new Date(verificationData.generatedAt).toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Data fingerprint</div>
            <div className="value mono">
              {verificationData.audit.dataFingerprint || "UNKNOWN"}
            </div>
          </div>
        </div>
      </section>

      <section className="panel section" aria-label="Security selector">
        <label>
          <span className="quick-title">Security</span>
          <select
            value={activeSymbol}
            onChange={(event) => setSelectedSymbol(event.target.value)}
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>
      </section>

      {stockData && latest && (
        <section className="panel section" aria-label="Latest observation">
          <div className="section-head">
            <h3>Latest observation</h3>
            <span className="mono">{activeSymbol}</span>
          </div>
          <div className="uqtl-grid">
            <div className="kpi-card">
              <div className="label">Observation date</div>
              <div className="value mono">{latest.date}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Price</div>
              <div className="value mono">
                {latest.price?.toLocaleString() ?? "MISSING"}
              </div>
            </div>
            <div className="kpi-card">
              <div className="label">Factor</div>
              <div className="value mono">
                {latest.factor?.toFixed(6) ?? "MISSING"}
              </div>
            </div>
            <div className="kpi-card">
              <div className="label">Position</div>
              <div className="value mono">
                {latest.position?.toFixed(6) ?? "MISSING"}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel section table-wrap" aria-label="Observation history">
        <div className="section-head">
          <h3>Observation history</h3>
          <span>Most recent 50 rows</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Price</th>
              <th>Factor</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {observations.slice(0, 50).map((row) => (
              <tr key={row.date}>
                <td className="mono">{row.date}</td>
                <td className="mono">
                  {row.price?.toLocaleString() ?? "MISSING"}
                </td>
                <td className="mono">
                  {row.factor?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">
                  {row.position?.toFixed(6) ?? "MISSING"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel section table-wrap" aria-label="Latest cross section">
        <div className="section-head">
          <h3>Latest cross section</h3>
          <span>Sorted by absolute modeled position</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Security</th>
              <th>Date</th>
              <th>Price</th>
              <th>Factor</th>
              <th>Position</th>
              <th>Rows</th>
            </tr>
          </thead>
          <tbody>
            {latestCrossSection.map((row) => (
              <tr key={row.symbol}>
                <td>
                  <button
                    type="button"
                    className="drilldown-link"
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedSymbol(row.symbol)}
                  >
                    {row.symbol}
                  </button>
                </td>
                <td className="mono">{row.date}</td>
                <td className="mono">
                  {row.price?.toLocaleString() ?? "MISSING"}
                </td>
                <td className="mono">
                  {row.factor?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">
                  {row.position?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">{row.observations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <RawDataToggle
        data={verificationData.individualData}
        fileName="individual_security_observations.json"
      />
    </div>
  );
};
