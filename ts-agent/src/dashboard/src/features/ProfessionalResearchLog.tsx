import type React from "react";
import { useMemo, useState } from "react";
import { RawDataToggle } from "../components/RawDataToggle";
import type { AlphaDiscoveryPayload } from "../dashboard_core";

interface ProfessionalResearchLogProps {
  alphaDiscovery: Map<string, AlphaDiscoveryPayload[]>;
  activeDate?: string;
  onSelectDate?: (date: string) => void;
}

type CandidateRecord = AlphaDiscoveryPayload["candidates"][number] & {
  date: string;
  generatedAt: string;
  quality: AlphaDiscoveryPayload["quality"];
};

export const ProfessionalResearchLog: React.FC<
  ProfessionalResearchLogProps
> = ({ alphaDiscovery, activeDate, onSelectDate }) => {
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "SELECTED" | "REJECTED"
  >("ALL");
  const [query, setQuery] = useState("");
  const [activeDateOnly, setActiveDateOnly] = useState(false);

  const records = useMemo(() => {
    const rows: CandidateRecord[] = [];
    for (const [date, payloads] of alphaDiscovery.entries()) {
      for (const payload of payloads) {
        for (const candidate of payload.candidates) {
          rows.push({
            ...candidate,
            date,
            generatedAt: payload.generatedAt,
            quality: payload.quality,
          });
        }
      }
    }
    return rows.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }, [alphaDiscovery]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
      if (activeDateOnly && activeDate && record.date !== activeDate) return false;
      if (!normalizedQuery) return true;
      return [
        record.id,
        record.description,
        record.reasoning,
        record.rejectReason ?? "",
        record.featureSignature ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [records, statusFilter, query, activeDateOnly, activeDate]);

  const selectedCount = records.filter(
    (record) => record.status === "SELECTED",
  ).length;
  const rejectedCount = records.length - selectedCount;
  const selectionRate =
    records.length === 0 ? 0 : (selectedCount / records.length) * 100;

  return (
    <div className="main">
      <div className="section-head">
        <div>
          <h2>Research ledger</h2>
          <span>Candidate lineage, selection decisions, and rejection evidence</span>
        </div>
        <span className="pill mono">RECORDS: {records.length}</span>
      </div>

      <section className="panel section" aria-label="Research summary">
        <div className="uqtl-grid">
          <div className="kpi-card">
            <div className="label">Total candidates</div>
            <div className="value">{records.length}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Selected</div>
            <div className="value pos">{selectedCount}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Rejected</div>
            <div className="value neg">{rejectedCount}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Selection rate</div>
            <div className="value">{selectionRate.toFixed(1)}%</div>
          </div>
        </div>
      </section>

      <section className="panel section" aria-label="Research filters">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <label>
            <span className="quick-title">Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "ALL" | "SELECTED" | "REJECTED",
                )
              }
            >
              <option value="ALL">All</option>
              <option value="SELECTED">Selected</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>

          <label style={{ flex: "1 1 280px" }}>
            <span className="quick-title">Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Candidate ID, description, feature, or rejection reason"
              style={{ width: "100%" }}
            />
          </label>

          {activeDate && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
              }}
            >
              <input
                type="checkbox"
                checked={activeDateOnly}
                onChange={(event) => setActiveDateOnly(event.target.checked)}
              />
              Observation {activeDate} only
            </label>
          )}
        </div>
      </section>

      <section className="panel section table-wrap" aria-label="Candidate records">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Candidate</th>
              <th>Status</th>
              <th>Description</th>
              <th>Priority</th>
              <th>Fitness</th>
              <th>Stability</th>
              <th>Adoption</th>
              <th>Evidence / rejection</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={`${record.date}-${record.id}`}>
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
                    onClick={() => onSelectDate?.(record.date)}
                  >
                    {record.date}
                  </button>
                </td>
                <td className="mono">{record.id}</td>
                <td>
                  <span
                    className={`pill ${record.status === "SELECTED" ? "ready" : "risk"}`}
                  >
                    {record.status}
                  </span>
                </td>
                <td>
                  <strong>{record.description}</strong>
                  <div className="quick-insight">{record.reasoning}</div>
                  {record.featureSignature && (
                    <div className="mono" style={{ marginTop: "0.3rem" }}>
                      FEATURE: {record.featureSignature}
                    </div>
                  )}
                </td>
                <td className="mono">{record.scores.priority.toFixed(3)}</td>
                <td className="mono">{record.scores.fitness.toFixed(3)}</td>
                <td className="mono">{record.scores.stability.toFixed(3)}</td>
                <td className="mono">{record.scores.adoption.toFixed(3)}</td>
                <td>
                  {record.rejectReason || "No rejection reason recorded"}
                  <div className="mono" style={{ marginTop: "0.3rem" }}>
                    QUALITY: {record.quality.completeness}
                  </div>
                  {record.referenceLinks?.map((link) => (
                    <div key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="empty" style={{ marginTop: "0.75rem" }}>
            No candidate records match the current filters.
          </div>
        )}
      </section>

      <RawDataToggle
        data={Object.fromEntries(alphaDiscovery.entries())}
        fileName="alpha_discovery_ledger.json"
      />
    </div>
  );
};
