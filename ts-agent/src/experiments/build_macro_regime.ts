import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AlphaKnowledgebase,
  type MacroRegimeInput,
} from "../context/alpha_knowledgebase.ts";
import { paths } from "../system/path_registry.ts";

type CliArgs = {
  from?: string;
  to?: string;
  window: number;
  dbPath?: string;
  sourcePath: string;
  riskOnThreshold: number;
  riskOffThreshold: number;
};

type MacroPoint = {
  MacroIIP?: number;
  MacroCPI?: number;
  MacroYieldSlope?: number;
};

const pickArg = (args: readonly string[], key: string): string | undefined => {
  const prefix = `${key}=`;
  const found = args.find((v) => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
};

const toIsoDate = (value: string): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const std = (values: readonly number[]): number => {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
};

const zscore = (windowValues: readonly number[], current: number): number => {
  const sigma = std(windowValues);
  if (sigma <= 1e-9) return 0;
  return (current - mean(windowValues)) / sigma;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const sourcePath = resolve(
    pickArg(args, "--source-path") ??
      `${paths.verificationRoot}/macro_indicators_map.json`,
  );
  const window = Math.max(
    3,
    Number.parseInt(pickArg(args, "--window") ?? "12", 10),
  );
  const from = pickArg(args, "--from");
  const to = pickArg(args, "--to");
  const riskOnThreshold = Number.parseFloat(
    pickArg(args, "--risk-on-threshold") ?? "0.5",
  );
  const riskOffThreshold = Number.parseFloat(
    pickArg(args, "--risk-off-threshold") ?? "-0.5",
  );
  const dbPathArg = pickArg(args, "--db-path");
  return {
    window,
    sourcePath,
    riskOnThreshold,
    riskOffThreshold,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(dbPathArg ? { dbPath: resolve(dbPathArg) } : {}),
  };
};

const determineRegime = (
  score: number,
  riskOnThreshold: number,
  riskOffThreshold: number,
): string => {
  if (score >= riskOnThreshold) return "RISK_ON";
  if (score <= riskOffThreshold) return "RISK_OFF";
  return "NEUTRAL";
};

async function run(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(args.sourcePath)) {
    throw new Error(
      `macro source not found: ${args.sourcePath}. run generate_macro_features.ts first.`,
    );
  }

  const raw = JSON.parse(readFileSync(args.sourcePath, "utf8")) as Record<
    string,
    MacroPoint
  >;
  const points = Object.entries(raw)
    .map(([dateRaw, values]) => {
      const date = toIsoDate(dateRaw);
      if (!date) return null;
      return {
        date,
        iip: Number(values.MacroIIP ?? Number.NaN),
        cpi: Number(values.MacroCPI ?? Number.NaN),
        yieldSlope: Number(values.MacroYieldSlope ?? 0),
      };
    })
    .filter(
      (
        row,
      ): row is {
        date: string;
        iip: number;
        cpi: number;
        yieldSlope: number;
      } => row !== null && Number.isFinite(row.iip) && Number.isFinite(row.cpi),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(
      (row) =>
        (!args.from || row.date >= args.from) &&
        (!args.to || row.date <= args.to),
    );

  if (points.length === 0) {
    throw new Error("no macro points available in selected period.");
  }

  const rows: MacroRegimeInput[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    const fromIndex = Math.max(0, i - args.window + 1);
    const win = points.slice(fromIndex, i + 1);
    const iipValues = win.map((v) => v.iip);
    const cpiValues = win.map((v) => v.cpi);
    const yieldValues = win.map((v) => v.yieldSlope);

    const iipZ = zscore(iipValues, point.iip);
    const inflationZ = zscore(cpiValues, point.cpi);
    const yieldSlopeZ = zscore(yieldValues, point.yieldSlope);
    const riskOnScore = iipZ - inflationZ + 0.5 * yieldSlopeZ;
    rows.push({
      date: point.date,
      regimeId: determineRegime(
        riskOnScore,
        args.riskOnThreshold,
        args.riskOffThreshold,
      ),
      inflationZ: clamp(inflationZ, -6, 6),
      iipZ: clamp(iipZ, -6, 6),
      yieldSlopeZ: clamp(yieldSlopeZ, -6, 6),
      riskOnScore: clamp(riskOnScore, -10, 10),
    });
  }

  const kb = new AlphaKnowledgebase(args.dbPath);
  kb.upsertMacroRegimes(rows);
  const counts = kb.getCounts();
  kb.close();

  console.log(
    JSON.stringify(
      {
        macroRegime: {
          sourcePath: args.sourcePath,
          dbPath:
            args.dbPath ?? `${paths.logsRoot}/cache/alpha_knowledgebase.sqlite`,
          points: rows.length,
          from: rows[0]?.date ?? "",
          to: rows[rows.length - 1]?.date ?? "",
          thresholds: {
            riskOn: args.riskOnThreshold,
            riskOff: args.riskOffThreshold,
          },
          counts,
        },
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
