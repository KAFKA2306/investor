import { readFileSync } from "node:fs";
import { z } from "zod";
import { paths } from "./path_registry.ts";

const SourceKindSchema = z.enum(["finance", "financials", "context"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

const RuntimePathsSchema = z.object({
  dataRoot: z.string().min(1),
  stockListCsv: z.string().min(1),
  stockPriceCsv: z.string().min(1),
  stockFinCsv: z.string().min(1),
});

const parseBoolLike = (value: string): boolean =>
  value === "True" || value === "1" || value === "true";

const normalizeSymbol = (symbol: string): string =>
  symbol.replace(".T", "").slice(0, 4);

export class DataPipelineRuntime {
  public readonly paths = RuntimePathsSchema.parse({
    dataRoot: paths.dataRoot,
    stockListCsv: paths.stockListCsv,
    stockPriceCsv: paths.stockPriceCsv,
    stockFinCsv: paths.stockFinCsv,
  });

  public resolveSources(input: string[]): SourceKind[] {
    const mapped = input
      .map((s) => s.trim().toLowerCase())
      .map((s) => {
        if (s === "finance" || s === "chart" || s === "price") return "finance";
        if (s === "fins" || s === "financials" || s === "statements")
          return "financials";
        if (s === "news" || s === "sns" || s === "onchain") return "context";
        return "";
      })
      .filter((s): s is SourceKind => s.length > 0);
    const unique = [...new Set(mapped)];
    if (unique.length === 0) {
      throw new Error("No valid data sources were provided");
    }
    return unique;
  }

  public resolveUniverse(
    requestedUniverse: string[],
    maxSymbols: number,
  ): string[] {
    const requested = [...new Set(requestedUniverse.map((s) => normalizeSymbol(s)))];
    if (requested.length > 0) return requested;
    return this.loadUniverseFromStockList(maxSymbols);
  }

  private loadUniverseFromStockList(maxSymbols: number): string[] {
    const content = readFileSync(this.paths.stockListCsv, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length < 2) {
      throw new Error("stock_list.csv has no data rows");
    }
    const header = lines[0]?.split(",").map((x) => x.trim()) ?? [];
    const codeIdx = header.indexOf("Local Code");
    const predIdx = header.indexOf("prediction_target");
    const uniIdx = header.indexOf("universe_comp2");
    if (codeIdx < 0) {
      throw new Error("Local Code column is required in stock_list.csv");
    }
    const selected: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]?.split(",") ?? [];
      const code = (cols[codeIdx] ?? "").replaceAll("\"", "").trim().slice(0, 4);
      if (!/^\d{4}$/.test(code)) continue;
      const pred = (cols[predIdx] ?? "").replaceAll("\"", "").trim();
      const uni = (cols[uniIdx] ?? "").replaceAll("\"", "").trim();
      if (predIdx >= 0 && !parseBoolLike(pred)) continue;
      if (uniIdx >= 0 && !parseBoolLike(uni)) continue;
      selected.push(code);
      if (selected.length >= maxSymbols) break;
    }
    if (selected.length === 0) {
      throw new Error("No symbols matched universe selection conditions");
    }
    return selected;
  }
}
