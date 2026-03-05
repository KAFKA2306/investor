import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  AlphaKnowledgebase,
  type MacroRegimeInput,
} from "../context/alpha_knowledgebase.ts";
import {
  getNumberArg,
  getStringArg,
  parseCliArgs,
} from "../providers/cli_args.ts";
import { EstatProvider } from "../providers/external_market_providers.ts";
import { paths } from "../system/path_registry.ts";
import { clamp, mean, stdDev as std } from "../utils/math_utils.ts";
import { toIsoDate } from "../utils/value_utils.ts";

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

const zscore = (windowValues: readonly number[], current: number): number => {
  const sigma = std(windowValues);
  if (sigma <= 1e-9) return 0;
  return (current - mean(windowValues)) / sigma;
};

const parseArgs = (): CliArgs => {
  const args = parseCliArgs(process.argv.slice(2));
  const sourcePath = resolve(
    getStringArg(args, "--source-path") ??
      `${paths.verificationRoot}/macro_indicators_map.json`,
  );
  const window = Math.max(3, Math.trunc(getNumberArg(args, "--window", 12)));
  const from = getStringArg(args, "--from");
  const to = getStringArg(args, "--to");
  const riskOnThreshold = getNumberArg(args, "--risk-on-threshold", 0.5);
  const riskOffThreshold = getNumberArg(args, "--risk-off-threshold", -0.5);
  const dbPathArg = getStringArg(args, "--db-path");
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

const generateMacroSourceFile = async (sourcePath: string): Promise<void> => {
  const estat = new EstatProvider();
  const IIP_ID = "0004015803"; // 2020 Base
  const CPI_ID = "0003427113"; // 2020 Base

  type EstatValue = { "@time": string; $: string };
  type EstatResponse = {
    GET_STATS_DATA?: {
      STATISTICAL_DATA?: {
        DATA_INF?: {
          VALUE?: EstatValue[];
        };
      };
    };
  };

  const extract = (
    data: EstatResponse,
    key: "MacroIIP" | "MacroCPI",
    out: Record<string, MacroPoint>,
  ) => {
    const gsd = data.GET_STATS_DATA;
    if (!gsd) return;

    // Build time mapping from metadata included in response
    const classObjsRaw = gsd.STATISTICAL_DATA?.CLASS_INF?.CLASS_OBJ ?? [];
    const classObjs = Array.isArray(classObjsRaw)
      ? classObjsRaw
      : [classObjsRaw];
    const timeObj = classObjs.find((c: any) => c["@id"] === "time");
    const timeClasses = Array.isArray(timeObj?.CLASS)
      ? timeObj.CLASS
      : [timeObj?.CLASS].filter(Boolean);

    const timeMap: Record<string, string> = {};
    for (const tc of timeClasses) {
      const name = tc["@name"];
      // Handle both "202502" and "2025年02月" formats
      const m = name.match(/(\d{4})[年-]?(\d{1,2})[月]?/);
      if (m) {
        const year = m[1];
        const month = m[2].padStart(2, "0");
        timeMap[tc["@code"]] = `${year}-${month}-01`;
      }
    }

    const values = gsd.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
    console.log(`[${key}] Total records: ${values.length}`);

    let matchCount = 0;
    for (const v of values) {
      // Filter for specific indicators
      if (key === "MacroIIP") {
        if (v["@cat01"] !== "0001000") continue;
      } else if (key === "MacroCPI") {
        if (
          v["@cat01"] !== "0001" ||
          v["@area"] !== "00000" ||
          v["@tab"] !== "1"
        )
          continue;
      }
      matchCount += 1;

      const date = timeMap[v["@time"]];
      if (!date) continue;

      const row = out[date] ?? {};
      row[key] = Number(v.$) || 0;
      out[date] = row;
    }
    console.log(
      `[${key}] Matched records: ${matchCount}, Final mapped: ${Object.keys(out).length}`,
    );
  };

  const macroMap: Record<string, MacroPoint> = {};
  const iipData = (await estat.getStats(IIP_ID)) as EstatResponse;
  const cpiData = (await estat.getStats(CPI_ID)) as EstatResponse;
  extract(iipData, "MacroIIP", macroMap);
  extract(cpiData, "MacroCPI", macroMap);
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, JSON.stringify(macroMap, null, 2));
};

async function run(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(args.sourcePath)) {
    console.log(
      `macro source not found: ${args.sourcePath}. generating source from e-Stat...`,
    );
    await generateMacroSourceFile(args.sourcePath);
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
