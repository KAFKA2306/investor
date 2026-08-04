import type React from "react";
import { useMemo, useState } from "react";
import { RawDataToggle } from "../components/RawDataToggle";
import type { StandardVerificationData } from "../dashboard_core";

interface ProfessionalSecuritiesViewProps {
  verificationData: StandardVerificationData | null;
}

export const ProfessionalSecuritiesView: React.FC<
  ProfessionalSecuritiesViewProps
> = ({ verificationData }) => {
  const securities = useMemo(() => {
    if (!verificationData?.individualData) return [];
    return Object.entries(verificationData.individualData)
      .map(([symbol, data]) => {
        const latestIndex = data.dates.length - 1;
        const firstPrice = data.prices[0];
        const latestPrice = data.prices[latestIndex];
        const periodReturn =
          firstPrice && latestPrice ? latestPrice / firstPrice - 1 : undefined;
        const averageFactor =
          data.factors.length > 0
            ? data.factors.reduce((sum, value) => sum + value, 0) /
              data.factors.length
            : undefined;
        const latestPosition = data.positions[latestIndex];
        const maximumAbsolutePosition = data.positions.reduce(
          (maximum, value) => Math.max(maximum, Math.abs(value)),
          0,
        );
        return {
          symbol,
          data,
          latestDate: data.dates[latestIndex] ?? "UNKNOWN",
          latestPrice,
          latestFactor: data.factors[latestIndex],
          latestPosition,
          periodReturn,
          averageFactor,
          maximumAbsolutePosition,
        };
      })
      .sort(
        (a, b) =>
          Math.abs(b.latestPosition ?? 0) - Math.abs(a.latestPosition ?? 0),
      );
  }, [verificationData]);

  const [selectedSymbol, setSelectedSymbol] = useState("");
  const active =
    securities.find((security) => security.symbol === selectedSymbol) ??
    securities[0];

  if (!verificationData?.individualData || securities.length === 0) {
    return (
      <div className="empty">
        Security-level observations are unavailable in the current validation
        artifact.
      </div>
    );
  }

  const activeRows = active.data.dates
    .map((date, index) => ({
      date,
      price: active.data.prices[index],
      factor: active.data.factors[index],
      position: active.data.positions[index],
    }))
    .reverse();

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>Securities</h2>
          <span>Security-level factor observations and modeled exposure</span>
        </div>
        <span className="pill mono">UNIVERSE: {securities.length}</span>
      </div>

      <section className="panel section table-wrap" aria-label="Security universe">
        <div className="section-head">
          <h3>Universe summary</h3>
          <span>Sorted by absolute latest modeled position</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Security</th>
              <th>Latest date</th>
              <th>Price</th>
              <th>Period return</th>
              <th>Latest factor</th>
              <th>Average factor</th>
              <th>Latest position</th>
              <th>Maximum absolute position</th>
            </tr>
          </thead>
          <tbody>
            {securities.map((security) => (
              <tr key={security.symbol}>
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
                    onClick={() => setSelectedSymbol(security.symbol)}
                  >
                    {security.symbol}
                  </button>
                </td>
                <td className="mono">{security.latestDate}</td>
                <td className="mono">
                  {security.latestPrice?.toLocaleString() ?? "MISSING"}
                </td>
                <td className="mono">
                  {security.periodReturn === undefined
                    ? "MISSING"
                    : `${(security.periodReturn * 100).toFixed(2)}%`}
                </td>
                <td className="mono">
                  {security.latestFactor?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">
                  {security.averageFactor?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">
                  {security.latestPosition?.toFixed(6) ?? "MISSING"}
                </td>
                <td className="mono">
                  {security.maximumAbsolutePosition.toFixed(6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel section" aria-label="Selected security identity">
        <div className="section-head">
          <h3>Selected security</h3>
          <span className="mono">{active.symbol}</span>
        </div>
        <div className="uqtl-grid">
          <div className="kpi-card">
            <div className="label">Latest date</div>
            <div className="value mono">{active.latestDate}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Latest price</div>
            <div className="value mono">
              {active.latestPrice?.toLocaleString() ?? "MISSING"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Latest factor</div>
            <div className="value mono">
              {active.latestFactor?.toFixed(6) ?? "MISSING"}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Latest modeled position</div>
            <div className="value mono">
              {active.latestPosition?.toFixed(6) ?? "MISSING"}
            </div>
          </div>
        </div>
      </section>

      <section className="panel section table-wrap" aria-label="Selected security observations">
        <div className="section-head">
          <h3>Observation history</h3>
          <span>Most recent 100 rows</span>
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
            {activeRows.slice(0, 100).map((row) => (
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

      <RawDataToggle
        data={verificationData.individualData}
        fileName="security_level_observations.json"
      />
    </div>
  );
};
