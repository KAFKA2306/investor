import type React from "react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RawDataToggle } from "../components/RawDataToggle";
import { ScatterChart } from "../components/ScatterChart";
import type { StandardVerificationData } from "../dashboard_core";

interface DataInspectorProps {
  verificationData: StandardVerificationData | null;
}

export const DataInspector: React.FC<DataInspectorProps> = ({
  verificationData,
}) => {
  const [mode, setMode] = useState<"single" | "cross_section">("single");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const symbols = useMemo(() => {
    if (!verificationData?.individualData) return [];
    return Object.keys(verificationData.individualData);
  }, [verificationData]);

  const currentSymbol = selectedSymbol || symbols[0];
  const stockData = useMemo(() => {
    if (!verificationData?.individualData || !currentSymbol) return null;
    return verificationData.individualData[currentSymbol];
  }, [verificationData, currentSymbol]);

  const dates = stockData?.dates || [];
  const currentDate = selectedDate || dates[dates.length - 1];

  // Prepare Single Symbol Data
  const singleChartData = useMemo(() => {
    if (!stockData) return [];
    return stockData.dates.map((date, i) => ({
      date:
        date.length === 8 ? `${date.slice(4, 6)}-${date.slice(6, 8)}` : date,
      price: stockData.prices[i],
      factor: stockData.factors[i],
      position: stockData.positions[i],
    }));
  }, [stockData]);

  // Prepare Cross Section Data
  const crossSectionData = useMemo(() => {
    if (!verificationData?.individualData || !currentDate) return [];

    const result = [];
    for (const [sym, data] of Object.entries(verificationData.individualData)) {
      const idx = data.dates.indexOf(currentDate);
      if (idx !== -1 && idx < data.dates.length - 1) {
        const factor = data.factors[idx];
        const priceToday = data.prices[idx];
        const priceTmr = data.prices[idx + 1];
        if (priceToday > 0) {
          result.push({
            symbol: sym,
            factor: factor,
            return: priceTmr / priceToday - 1,
            position: data.positions[idx],
          });
        }
      }
    }
    return result.sort((a, b) => b.factor - a.factor);
  }, [verificationData, currentDate]);

  // Calculate Herfindahl Index (HHI) for positions
  const hhi = useMemo(() => {
    if (!verificationData?.individualData || !currentDate) return 0;
    let sumAbsPos = 0;
    const positions = [];
    for (const data of Object.values(verificationData.individualData)) {
      const idx = data.dates.indexOf(currentDate);
      if (idx !== -1) {
        const p = data.positions[idx] || 0;
        sumAbsPos += Math.abs(p);
        positions.push(p);
      }
    }
    if (sumAbsPos === 0) return 0;
    return positions.reduce((acc, p) => acc + (p / sumAbsPos) ** 2, 0);
  }, [verificationData, currentDate]);

  if (!verificationData || !verificationData.individualData) {
    return (
      <div className="empty">
        No individual stock data available in verification logs.
      </div>
    );
  }

  const topSymbols = crossSectionData.slice(0, 5);
  const bottomSymbols = crossSectionData.slice(-5).reverse();

  return (
    <div className="main tab-fade">
      <div className="section-head">
        <h2>Data Inspector</h2>
        <div
          className="workflow-controls rail"
          style={{
            flexDirection: "row",
            background: "var(--bg-soft)",
            padding: "0.2rem",
            borderRadius: "999px",
          }}
        >
          <button
            type="button"
            className={`tab-btn ${mode === "single" ? "active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single Symbol
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === "cross_section" ? "active" : ""}`}
            onClick={() => setMode("cross_section")}
          >
            Cross Section
          </button>
        </div>
      </div>

      {mode === "single" && (
        <>
          <div
            className="panel section"
            style={{ display: "flex", gap: "1rem", alignItems: "center" }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Select Symbol:
            </span>
            <select
              className="input-select"
              value={currentSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{ width: "200px" }}
            >
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-grid">
            <div className="panel section">
              <h3 className="quick-title">Price Series</h3>
              <div
                className="chart-recharts-wrapper"
                style={{ height: "240px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={singleChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--line)"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel section">
              <h3 className="quick-title">Factor Values</h3>
              <div
                className="chart-recharts-wrapper"
                style={{ height: "240px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={singleChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--line)"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="factor"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel section">
              <h3 className="quick-title">Target Position</h3>
              <div
                className="chart-recharts-wrapper"
                style={{ height: "240px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={singleChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--line)"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                    />
                    <Tooltip />
                    <Line
                      type="stepAfter"
                      dataKey="position"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <RawDataToggle
            data={stockData}
            fileName={`stock_${currentSymbol}.json`}
          />
        </>
      )}

      {mode === "cross_section" && (
        <>
          <div
            className="panel section"
            style={{ display: "flex", gap: "1rem", alignItems: "center" }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Evaluation Date:
            </span>
            <select
              className="input-select"
              value={currentDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: "200px" }}
            >
              {dates.slice(0, dates.length - 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Valid Universe:{" "}
                <strong style={{ color: "var(--brand)" }}>
                  {crossSectionData.length}
                </strong>
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Position HHI:{" "}
                <strong
                  style={{
                    color: hhi > 0.1 ? "var(--danger)" : "var(--brand)",
                  }}
                >
                  {hhi.toFixed(4)}
                </strong>
              </span>
            </div>
          </div>

          <div className="inspector-cross-section">
            <div className="panel section">
              <h3 className="quick-title">Factor vs Forward Return</h3>
              <ScatterChart
                data={crossSectionData}
                onClick={(sym) => {
                  setSelectedSymbol(sym);
                  setMode("single");
                }}
              />
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="panel section table-wrap" style={{ flex: 1 }}>
                <h3 className="quick-title" style={{ color: "var(--brand)" }}>
                  Top 5 Factors
                </h3>
                <table style={{ minWidth: "100%", marginTop: "0.5rem" }}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Factor</th>
                      <th>Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSymbols.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <button
                            type="button"
                            className="drilldown-link"
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                            }}
                            onClick={() => {
                              setSelectedSymbol(row.symbol);
                              setMode("single");
                            }}
                          >
                            {row.symbol}
                          </button>
                        </td>
                        <td>{row.factor.toFixed(4)}</td>
                        <td>{row.position.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel section table-wrap" style={{ flex: 1 }}>
                <h3 className="quick-title" style={{ color: "var(--danger)" }}>
                  Bottom 5 Factors
                </h3>
                <table style={{ minWidth: "100%", marginTop: "0.5rem" }}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Factor</th>
                      <th>Pos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottomSymbols.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <button
                            type="button"
                            className="drilldown-link"
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                            }}
                            onClick={() => {
                              setSelectedSymbol(row.symbol);
                              setMode("single");
                            }}
                          >
                            {row.symbol}
                          </button>
                        </td>
                        <td>{row.factor.toFixed(4)}</td>
                        <td>{row.position.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <RawDataToggle
            data={crossSectionData}
            fileName={`cross_section_${currentDate}.csv`}
          />
        </>
      )}
    </div>
  );
};
