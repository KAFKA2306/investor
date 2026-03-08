import * as fs from "node:fs";
import * as path from "node:path";
import type { YahooBar } from "../providers/external_market_providers";

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
        .map((h) => {
          const val = row[h];
          return typeof val === "number" && Number.isNaN(val) ? "" : val;
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
  bars: YahooBar[],
  factors: Record<string, number[]>,
): QlibExportRow[] {
  return bars.map((bar, i) => {
    const row: QlibExportRow = {
      date: bar.Date,
      symbol,
      open: bar.Open,
      high: bar.High,
      low: bar.Low,
      close: bar.Close,
      volume: bar.Volume,
    };

    for (const [name, series] of Object.entries(factors)) {
      row[name] = series[i];
    }

    return row;
  });
}
