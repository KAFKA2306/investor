import type React from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlphaPassportCard } from "../components/AlphaPassportCard";
import { RawDataToggle } from "../components/RawDataToggle";
import type { AlphaDiscoveryPayload } from "../dashboard_core";

interface ResearchLogProps {
  alphaDiscovery: Map<string, AlphaDiscoveryPayload[]>;
  activeDate?: string;
  onSelectDate?: (date: string) => void;
}

type CandidateLogEntry = AlphaDiscoveryPayload["candidates"][number] & {
  date: string;
  generatedAt: string;
};

export const ResearchLog: React.FC<ResearchLogProps> = ({
  alphaDiscovery,
  activeDate,
  onSelectDate,
}) => {
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "SELECTED" | "REJECTED"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [filterToActive, setFilterToActive] = useState(false);

  const allCandidates = useMemo(() => {
    const list: CandidateLogEntry[] = [];
    for (const [date, payloads] of alphaDiscovery.entries()) {
      for (const payload of payloads) {
        for (const candidate of payload.candidates) {
          list.push({
            ...candidate,
            date,
            generatedAt: payload.generatedAt,
          });
        }
      }
    }
    return list.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }, [alphaDiscovery]);

  const stats = useMemo(() => {
    const total = allCandidates.length;
    const selected = allCandidates.filter(
      (c) => c.status === "SELECTED",
    ).length;
    const rejected = total - selected;
    return {
      total,
      selected,
      rejected,
      rate: total > 0 ? (selected / total) * 100 : 0,
    };
  }, [allCandidates]);

  const filteredCandidates = useMemo(() => {
    let list = allCandidates;
    if (filterStatus !== "ALL") {
      list = list.filter((c) => c.status === filterStatus);
    }
    if (filterToActive && activeDate) {
      list = list.filter((c) => c.date === activeDate);
    }
    return list;
  }, [allCandidates, filterStatus, filterToActive, activeDate]);

  const chartData = [
    { name: "Selected", value: stats.selected, fill: "var(--brand)" },
    { name: "Rejected", value: stats.rejected, fill: "var(--danger)" },
  ];

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 4) {
        alert("You can compare up to 4 candidates at a time.");
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const parseRejectReason = (reason?: string) => {
    if (!reason) return null;
    // Tries to parse "Sharpe 0.62 < 1.8" into structured data. Very simple heuristic for display.
    const parts = reason.match(/([a-zA-Z]+)\s+([\d.-]+)\s*([<>])\s*([\d.-]+)/);
    if (parts) {
      return {
        metric: parts[1],
        value: Number.parseFloat(parts[2]),
        op: parts[3],
        threshold: Number.parseFloat(parts[4]),
        source: `verification.metrics.${parts[1].toLowerCase()}`,
      };
    }
    return { raw: reason };
  };

  return (
    <div className="main">
      <div className="section-head">
        <h2>Research Log</h2>
        <span className="pill">Total Attempts: {stats.total}</span>
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">Hypothesis Evolution</h1>
          <p className="hero-subtitle">
            Historical record of all alpha discovery attempts.
          </p>
          <div className="uqtl-grid" style={{ marginTop: "1rem" }}>
            <div className="kpi-card">
              <div className="label">Discovery Rate</div>
              <div className="value">{stats.rate.toFixed(1)}%</div>
            </div>
            <div className="kpi-card">
              <div className="label">Selected</div>
              <div className="value pos">{stats.selected}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Rejected</div>
              <div className="value neg">{stats.rejected}</div>
            </div>
          </div>
        </div>
        <div
          className="hero-side"
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <div className="chart-recharts-wrapper" style={{ height: "140px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--glass-bg)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    fontSize: "10px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            Selection Summary
          </div>
        </div>
      </div>

      <div className="panel section" style={{ minHeight: "240px" }}>
        <h3 className="quick-title">
          Discovery Progress (Priority vs Novelty)
        </h3>
        <div style={{ height: "200px", marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={allCandidates.slice().reverse()}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--glass-bg)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
              <Line
                type="monotone"
                dataKey="scores.priority"
                name="Priority"
                stroke="var(--brand)"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="scores.novelty"
                name="Novelty"
                stroke="var(--accent)"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className="panel section"
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {activeDate && (
            <label
              style={{
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                cursor: "pointer",
                color: "var(--ink-soft)",
              }}
            >
              <input
                type="checkbox"
                checked={filterToActive}
                onChange={(e) => setFilterToActive(e.target.checked)}
              />
              {activeDate} に絞るっ！🎯
            </label>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["ALL", "SELECTED", "REJECTED"].map((status) => (
              <button
                key={status}
                type="button"
                className={`tab-btn ${filterStatus === status ? "active" : ""}`}
                onClick={() =>
                  setFilterStatus(status as "ALL" | "SELECTED" | "REJECTED")
                }
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="button"
              onClick={() => setShowCompare(!showCompare)}
            >
              {showCompare
                ? "比較を閉じるっ！"
                : `選ばれた子を比較っ！ (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {showCompare && selectedIds.size > 0 && (
        <div className="panel section">
          <h3 className="quick-title">Candidate Comparison</h3>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Metric / Feature</th>
                  {Array.from(selectedIds).map((id) => {
                    const _c = allCandidates.find((x) => x.id === id);
                    return (
                      <th
                        key={id}
                        style={{ width: `${100 / (selectedIds.size + 1)}%` }}
                      >
                        {id.slice(0, 8)}...
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Status</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id}>
                        <span
                          className={`chip ${c?.status === "SELECTED" ? "ready" : "risk"}`}
                        >
                          {c?.status || "UNKNOWN"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Risk Adj. Score</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id}>
                        {c?.scores.riskAdjusted.toFixed(3) || "N/A"}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Novelty Score</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id}>{c?.scores.novelty.toFixed(3) || "N/A"}</td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Feature Signature</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id}>
                        <pre
                          style={{
                            fontSize: "0.65rem",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: "var(--brand)",
                          }}
                        >
                          {c?.featureSignature || "N/A"}
                        </pre>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="main" style={{ gap: "2rem" }}>
        {filteredCandidates.map((candidate) => {
          const parsedReason = parseRejectReason(candidate.rejectReason);
          return (
            <div
              key={`${candidate.date}-${candidate.id}`}
              style={{
                borderLeft: "4px solid var(--line)",
                paddingLeft: "1rem",
              }}
            >
              <div
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(candidate.id)}
                  onChange={() => handleToggleSelect(candidate.id)}
                  style={{ cursor: "pointer" }}
                />
                <span
                  className="timeline-date"
                  style={{
                    fontWeight:
                      candidate.date === activeDate ? "bold" : "normal",
                    color:
                      candidate.date === activeDate
                        ? "var(--brand)"
                        : "inherit",
                  }}
                >
                  {candidate.date} {candidate.date === activeDate && "✨"}
                </span>
                <span style={{ fontSize: "0.6rem", color: "var(--ink-soft)" }}>
                  {new Date(candidate.generatedAt).toLocaleString()}
                </span>
                {onSelectDate && candidate.date !== activeDate && (
                  <button
                    type="button"
                    className="button"
                    style={{ fontSize: "0.55rem", padding: "2px 6px" }}
                    onClick={() => onSelectDate(candidate.date)}
                  >
                    この日にジャンプっ！🕰️
                  </button>
                )}
              </div>

              <AlphaPassportCard
                id={candidate.id}
                description={candidate.description}
                reasoning={candidate.reasoning}
                scores={candidate.scores}
                status={candidate.status}
                featureSignature={candidate.featureSignature}
                ast={candidate.ast}
                docId={candidate.docId}
                edinetCode={candidate.edinetCode}
                referenceLinks={candidate.referenceLinks}
              />

              {candidate.status === "REJECTED" && parsedReason && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--ink-soft)",
                      textTransform: "uppercase",
                    }}
                  >
                    Rejection Logic
                  </span>
                  {parsedReason.raw ? (
                    <div className="reject-reason-row">
                      <span
                        style={{ color: "var(--danger)", fontWeight: "bold" }}
                      >
                        ✖ FAILED
                      </span>
                      <span style={{ gridColumn: "span 2" }}>
                        {parsedReason.raw}
                      </span>
                    </div>
                  ) : (
                    <div className="reject-reason-row">
                      <span
                        style={{
                          color: "var(--danger)",
                          fontWeight: "bold",
                          textAlign: "center",
                        }}
                      >
                        ✖ FAILED
                      </span>
                      <span>
                        {parsedReason.metric}:{" "}
                        <strong style={{ color: "var(--danger)" }}>
                          {parsedReason.value}
                        </strong>{" "}
                        {parsedReason.op} {parsedReason.threshold}
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontFamily: "var(--mono)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        source: {parsedReason.source}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="panel section empty">No research history found.</div>
      )}

      <RawDataToggle data={allCandidates} fileName="all_candidates.json" />
    </div>
  );
};
