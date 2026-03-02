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
  const [adoptionThreshold, setAdoptionThreshold] = useState(0.0);

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
    list = list.filter((c) => (c.scores.adoption ?? 0) >= adoptionThreshold);
    return list;
  }, [
    allCandidates,
    filterStatus,
    filterToActive,
    activeDate,
    adoptionThreshold,
  ]);

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
        <h2>リサーチ・ログ 📜✨</h2>
        <span className="pill" style={{ border: "1px solid var(--line)" }}>
          総試行回数：{stats.total}
        </span>
      </div>

      <div className="hero panel hero-uqtl">
        <div className="hero-content">
          <h1 className="hero-title">アルファ進化の系譜 🧬</h1>
          <p className="hero-subtitle">
            これまでの全アルファ探索の記録だよ。取捨選択の歴史がここにあるんだもんっ！✨
          </p>
          <div className="uqtl-grid" style={{ marginTop: "1rem" }}>
            <div className="kpi-card">
              <div className="label">採用率 (Discovery)</div>
              <div className="value">{stats.rate.toFixed(1)}%</div>
            </div>
            <div className="kpi-card">
              <div className="label">採用済み (Selected)</div>
              <div className="value pos">{stats.selected}</div>
            </div>
            <div className="kpi-card">
              <div className="label">不採用 (Rejected)</div>
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
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-panel)",
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
              fontWeight: "bold",
            }}
          >
            アルファ選別サマリー 📊
          </div>
        </div>
      </div>

      <div
        className="panel section"
        style={{ minHeight: "240px", border: "1px solid var(--line)" }}
      >
        <h3 className="quick-title">
          探索の進捗状況 (重要度 vs フィットネス) 📈
        </h3>
        <div style={{ height: "200px", marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={allCandidates.slice().reverse()}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="date" hide />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
              <Line
                type="monotone"
                dataKey="scores.priority"
                name="重要度 (Priority)"
                stroke="var(--brand)"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="scores.fitness"
                name="フィットネス (Fitness)"
                stroke="var(--accent)"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="scores.stability"
                name="安定性 (Stability)"
                stroke="var(--success)"
                dot={false}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="scores.adoption"
                name="採用度 (Adoption)"
                stroke="var(--caution)"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="8 4"
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
          background: "var(--bg-soft)",
          border: "1px solid var(--line)",
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
                fontWeight: "bold",
              }}
            >
              <input
                type="checkbox"
                checked={filterToActive}
                onChange={(e) => setFilterToActive(e.target.checked)}
              />
              {activeDate} の試行のみ表示🎯
            </label>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[
              { id: "ALL", label: "すべて" },
              { id: "SELECTED", label: "採用のみ" },
              { id: "REJECTED", label: "不採用のみ" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`tab-btn ${filterStatus === f.id ? "active" : ""}`}
                onClick={() => setFilterStatus(f.id as any)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div
            style={{
              height: "20px",
              width: "1px",
              background: "var(--line)",
              margin: "0 0.5rem",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
              padding: "0 0.5rem",
            }}
          >
            <label
              style={{
                fontSize: "0.75rem",
                color: "var(--ink-soft)",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.8rem",
              }}
            >
              Min Adoption:
              <span
                style={{
                  color: "var(--brand)",
                  marginLeft: "0.4rem",
                  fontFamily: "var(--mono)",
                  fontSize: "0.8rem",
                }}
              >
                {(adoptionThreshold * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={adoptionThreshold}
                onChange={(e) =>
                  setAdoptionThreshold(Number.parseFloat(e.target.value))
                }
                style={{
                  width: "120px",
                  accentColor: "var(--brand)",
                  cursor: "pointer",
                }}
              />
            </label>
          </div>
        </div>
        <div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="button"
              onClick={() => setShowCompare(!showCompare)}
              style={{ fontWeight: "bold" }}
            >
              {showCompare
                ? "比較画面を閉じる"
                : `選んだアルファを比較中っ！ (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {showCompare && selectedIds.size > 0 && (
        <div
          className="panel section"
          style={{ border: "2px solid var(--brand-soft)" }}
        >
          <h3 className="quick-title">アルファ候補の徹底比較 ⚖️</h3>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>項目 / パラメータ</th>
                  {Array.from(selectedIds).map((id) => {
                    const _c = allCandidates.find((x) => x.id === id);
                    return (
                      <th
                        key={id}
                        style={{
                          width: `${100 / (selectedIds.size + 1)}%`,
                          textAlign: "center",
                        }}
                      >
                        {id.slice(0, 8)}...
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>採択ステータス</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id} style={{ textAlign: "center" }}>
                        <span
                          className={`chip ${c?.status === "SELECTED" ? "ready" : "risk"}`}
                          style={{ fontWeight: "bold" }}
                        >
                          {c?.status === "SELECTED" ? "ADOPTED" : "REJECTED"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>フィットネス (Fitness)</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td
                        key={id}
                        style={{
                          textAlign: "center",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {(c?.scores.fitness ?? 0).toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>安定性 (Stability)</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td
                        key={id}
                        style={{
                          textAlign: "center",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {(c?.scores.stability ?? 0).toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>採用度 (Adoption)</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td
                        key={id}
                        style={{
                          textAlign: "center",
                          fontFamily: "var(--mono)",
                        }}
                      >
                        {(c?.scores.adoption ?? 0).toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>特徴量シグネチャ</td>
                  {Array.from(selectedIds).map((id) => {
                    const c = allCandidates.find((x) => x.id === id);
                    return (
                      <td key={id}>
                        <pre
                          style={{
                            fontSize: "0.6rem",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: "var(--brand)",
                            background: "var(--bg-soft)",
                            padding: "0.4rem",
                            borderRadius: "4px",
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
                  gap: "0.8rem",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(candidate.id)}
                  onChange={() => handleToggleSelect(candidate.id)}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <span
                  className="timeline-date"
                  style={{
                    fontSize: "0.9rem",
                    fontWeight:
                      candidate.date === activeDate ? "bold" : "normal",
                    color:
                      candidate.date === activeDate
                        ? "var(--brand)"
                        : "var(--ink-soft)",
                  }}
                >
                  {candidate.date} {candidate.date === activeDate && "📍"}
                </span>
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--ink-soft)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  {new Date(candidate.generatedAt).toLocaleString()}
                </span>
                {onSelectDate && candidate.date !== activeDate && (
                  <button
                    type="button"
                    className="button"
                    style={{
                      fontSize: "0.55rem",
                      padding: "2px 8px",
                      background: "none",
                      border: "1px solid var(--line)",
                      color: "var(--ink-soft)",
                    }}
                    onClick={() => onSelectDate(candidate.date)}
                  >
                    この日に移動っ！🕰️
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
                <div
                  style={{
                    marginTop: "0.8rem",
                    padding: "0.8rem",
                    background: "rgba(255,0,0,0.02)",
                    borderRadius: "8px",
                    border: "1px dashed var(--danger-soft)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--danger)",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "0.4rem",
                    }}
                  >
                    不採用判定の理由 (Rejection Logic)
                  </span>
                  {parsedReason.raw ? (
                    <div
                      className="reject-reason-row"
                      style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--danger)",
                          fontWeight: "bold",
                          fontSize: "0.75rem",
                        }}
                      >
                        ✖ CRITERIA FAILED
                      </span>
                      <span style={{ fontSize: "0.75rem" }}>
                        {parsedReason.raw}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="reject-reason-row"
                      style={{
                        display: "flex",
                        gap: "1rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--danger)",
                          fontWeight: "bold",
                          fontSize: "0.75rem",
                        }}
                      >
                        ✖ CRITERIA FAILED
                      </span>
                      <span style={{ fontSize: "0.75rem" }}>
                        {parsedReason.metric}:{" "}
                        <strong style={{ color: "var(--danger)" }}>
                          {parsedReason.value}
                        </strong>{" "}
                        {parsedReason.op} {parsedReason.threshold}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          fontFamily: "var(--mono)",
                          color: "var(--ink-soft)",
                          marginLeft: "auto",
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
        <div className="panel section empty">
          該当するリサーチログが見つからないよぉ…😢
        </div>
      )}

      <RawDataToggle data={allCandidates} fileName="all_candidates.json" />
    </div>
  );
};
