import type React from "react";
import { useState } from "react";

interface RawDataToggleProps {
  data: unknown;
  fileName?: string;
}

export const RawDataToggle: React.FC<RawDataToggleProps> = ({
  data,
  fileName = "data.csv",
}) => {
  const [showJson, setShowJson] = useState(false);

  const downloadCsv = () => {
    if (!data || typeof data !== "object") return;

    // Simple flat object/array to CSV converter
    let csvContent = "";
    if (Array.isArray(data)) {
      if (data.length === 0) return;
      const headers = Object.keys(data[0]);
      csvContent += `${headers.join(",")}\n`;
      for (const row of data) {
        csvContent += `${headers.map((h) => JSON.stringify(row[h])).join(",")}\n`;
      }
    } else {
      const entries = Object.entries(data as object);
      csvContent += "Key,Value\n";
      for (const [k, v] of entries) {
        csvContent += `${k},${JSON.stringify(v)}\n`;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      fileName.endsWith(".csv") ? fileName : `${fileName}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div
        style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}
      >
        <button
          type="button"
          className="raw-toggle-btn"
          onClick={() => setShowJson(!showJson)}
        >
          {showJson ? "Hide RAW" : "Inspect RAW"}
        </button>
        <button type="button" className="raw-toggle-btn" onClick={downloadCsv}>
          Download CSV
        </button>
      </div>
      {showJson && (
        <div className="json-block">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
