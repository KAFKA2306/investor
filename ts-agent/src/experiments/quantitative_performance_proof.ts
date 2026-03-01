import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { calculatePerformanceMetrics } from "../pipeline/evaluate/evaluation_metrics_core.ts";
import {
  getNumberArg,
  getStringArg,
  parseCliArgs,
} from "../providers/cli_args.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import {
  clamp,
  mean,
  toIsoDate,
  toSymbol4,
} from "../providers/value_normalizers.ts";
import { DataPipelineRuntime } from "../system/data_pipeline_runtime.ts";
import { paths } from "../system/path_registry.ts";

type CliArgs = {
  symbols: string[];
  limit: number;
  dbPath?: string;
  from?: string;
  to?: string;
};

type IntelligencePoint = {
  sentiment: number;
  aiExposure: number;
  kgCentrality: number;
  correctionFlag: number;
  correctionCount90d: number;
};

type IntelligenceMap = Record<string, Record<string, IntelligencePoint>>;

type NormalizedBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const parseArgs = (): CliArgs => {
  const args = parseCliArgs(process.argv.slice(2));
  const limit = Math.max(1, getNumberArg(args, "--limit", 3000));
  const rawSymbols = getStringArg(args, "--symbols");
  const symbols = rawSymbols
    ? rawSymbols
        .split(",")
        .map((s) => toSymbol4(s.trim()))
        .filter((s) => /^\d{4}$/.test(s))
    : [];
  const from = getStringArg(args, "--from");
  const to = getStringArg(args, "--to");
  const dbPathArg = getStringArg(args, "--db-path");
  const parsed: CliArgs = {
    limit,
    symbols,
  };
  if (from) parsed.from = from;
  if (to) parsed.to = to;
  if (dbPathArg) parsed.dbPath = resolve(dbPathArg);
  return parsed;
};

const intelligenceMapPath = (): string =>
  join(paths.verificationRoot, "edinet_10k_intelligence_map.json");

const loadIntelligenceMap = (): IntelligenceMap => {
  const filePath = intelligenceMapPath();
  if (!existsSync(filePath)) return {};
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<
    string,
    Record<string, Partial<IntelligencePoint>>
  >;
  const result: IntelligenceMap = {};
  for (const [symbolRaw, datedValues] of Object.entries(raw)) {
    const symbol = toSymbol4(symbolRaw);
    if (!/^\d{4}$/.test(symbol)) continue;
    for (const [dateRaw, point] of Object.entries(datedValues)) {
      const isoDate = toIsoDate(dateRaw);
      if (!isoDate) continue;
      if (!result[symbol]) result[symbol] = {};
      result[symbol][isoDate] = {
        sentiment: clamp(Number(point.sentiment ?? 0.5), 0, 1),
        aiExposure: Math.max(0, Number(point.aiExposure ?? 0)),
        kgCentrality: Math.max(0, Number(point.kgCentrality ?? 0)),
        correctionFlag: Number(point.correctionFlag ?? 0) > 0 ? 1 : 0,
        correctionCount90d: Math.max(
          0,
          Math.floor(Number(point.correctionCount90d ?? 0)),
        ),
      };
    }
  }
  return result;
};

const normalizeBars = (
  rows: readonly Record<string, unknown>[],
): NormalizedBar[] =>
  rows
    .map((row) => {
      const date = toIsoDate(String(row.Date ?? row.date ?? ""));
      if (!date) return null;
      const open = Number(row.Open ?? row.open ?? 0);
      const close = Number(row.Close ?? row.close ?? 0);
      if (open <= 0 || close <= 0) return null;
      return {
        date,
        open,
        high: Number(row.High ?? row.high ?? close),
        low: Number(row.Low ?? row.low ?? close),
        close,
        volume: Number(row.Volume ?? row.volume ?? 0),
      };
    })
    .filter((row): row is NormalizedBar => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

async function run(): Promise<void> {
  const args = parseArgs();
  const intelligenceMap = loadIntelligenceMap();
  const runtime = new DataPipelineRuntime();
  const autoUniverse =
    args.symbols.length > 0
      ? args.symbols
      : runtime.resolveUniverse([], args.limit);
  const targetSymbols = autoUniverse.slice(0, args.limit);

  if (targetSymbols.length === 0) {
    throw new Error("No symbols selected for proof.");
  }

  console.log(`📊 Performance Proof for ${targetSymbols.length} symbols...`);
  const gateway = await MarketdataLocalGateway.create(targetSymbols);
  const dailyPnl: Record<string, number[]> = {};

  for (const symbol of targetSymbols) {
    const barsRaw = await gateway.getBarsAll(symbol);
    const bars = normalizeBars(barsRaw);
    if (bars.length < 10) continue;

    const points = intelligenceMap[symbol] ?? {};
    const filingDates = Object.keys(points).sort();

    let prevRiskScore: number | null = null;
    for (const filingDate of filingDates) {
      if (args.from && filingDate < args.from) continue;
      if (args.to && filingDate > args.to) continue;

      const idx = bars.findIndex((b) => b.date === filingDate);
      if (idx < 0 || idx + 5 >= bars.length) continue;

      const point = points[filingDate];
      if (!point) continue;
      const riskScore = 1 - point.sentiment + Math.log1p(point.aiExposure) / 6;
      const riskDelta = prevRiskScore === null ? 0 : riskScore - prevRiskScore;
      prevRiskScore = riskScore;

      const nextReturn = bars[idx + 1]!.close / bars[idx]!.close - 1;
      const signalValue = -riskDelta;

      if (!dailyPnl[filingDate]) dailyPnl[filingDate] = [];
      dailyPnl[filingDate].push(signalValue * nextReturn);
    }
  }

  const sortedDates = Object.keys(dailyPnl).sort();
  const pnlSeries = sortedDates.map((d) => mean(dailyPnl[d] ?? [0]));
  const metrics = calculatePerformanceMetrics(pnlSeries);

  console.log(
    JSON.stringify(
      {
        proof: {
          symbols: targetSymbols.length,
          days: sortedDates.length,
          sharpe: metrics.sharpe,
          totalReturn: metrics.cumulativeReturn,
          maxDrawdown: metrics.maxDrawdown,
          winRate: metrics.winRate,
        },
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
