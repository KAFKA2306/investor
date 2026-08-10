import * as fs from "node:fs";
import * as path from "node:path";
import type { MarketBar } from "../schemas/financial_domain_schemas.ts";

export interface QlibExportRow {
  date: string;
  symbol: string;
  [key: string]: string | number;
}

export async function exportToQlibCsv(
  data: QlibExportRow[],
  outputPath: string,
): Promise<void> {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return typeof value === "number" && Number.isNaN(value) ? "" : value;
        })
        .join(","),
    ),
  ].join("\n");

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, csvContent);
}

export function prepareQlibRows(
  symbol: string,
  bars: MarketBar[],
  factors: Record<string, number[]>,
): QlibExportRow[] {
  return bars.map((bar, index) => {
    const row: QlibExportRow = {
      date: bar.date,
      symbol,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    };

    for (const [name, series] of Object.entries(factors)) {
      row[name] = series[index] ?? Number.NaN;
    }

    return row;
  });
}
