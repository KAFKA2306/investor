import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type YahooBar,
  YahooFinanceGateway,
} from "../providers/yahoo_finance_market_provider.ts";

type CliArgs = {
  symbols: string[];
  range: string;
  outDir: string;
};

type OutputRow = {
  Timestamp: string;
  AssetPrice: number;
  FactorValue: number;
  Position: number;
  Volatility: number;
  CumReturn: number;
  Drawdown: number;
};

const DEFAULT_RANGE = "1y";
const DEFAULT_OUT_DIR = join(process.cwd(), "data");

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const toCsvSafeName = (symbol: string): string =>
  symbol
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

const mean = (values: readonly number[]): number =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const std = (values: readonly number[]): number => {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const v =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(0, v));
};

const pickArg = (args: string[], key: string): string | undefined => {
  const prefix = `${key}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const rawSymbols = pickArg(args, "--symbols") ?? pickArg(args, "--symbol");
  const symbols = rawSymbols
    ? rawSymbols
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : ["9984.T", "NVDA"];

  const range = pickArg(args, "--range") ?? DEFAULT_RANGE;
  const outDir = resolve(pickArg(args, "--out-dir") ?? DEFAULT_OUT_DIR);

  return { symbols, range, outDir };
};

function computeRows(bars: readonly YahooBar[]): OutputRow[] {
  if (bars.length === 0) return [];

  const closes = bars.map((b) => b.Close);
  const returns = closes.map((close, i) => {
    if (i === 0) return 0;
    const prev = closes[i - 1] ?? close;
    return prev === 0 ? 0 : close / prev - 1;
  });

  let cumReturn = 0;
  let runningMax = 0;
  let prevPosition = 0;

  return bars.map((bar, i) => {
    const shortStart = Math.max(0, i - 5);
    const longStart = Math.max(0, i - 20);
    const volStart = Math.max(0, i - 20);

    const shortWindow = closes.slice(shortStart, i + 1);
    const longWindow = closes.slice(longStart, i + 1);
    const volWindow = returns.slice(volStart, i + 1);

    const shortMean = mean(shortWindow);
    const longMean = mean(longWindow);
    const volatility = std(volWindow) * Math.sqrt(252);

    const regime =
      longMean === 0
        ? 0
        : (shortMean - longMean) / Math.max(Math.abs(longMean), 1e-9);
    const normalized = regime / Math.max(volatility, 1e-6);

    // Keep the signal range close to the historic data artifacts.
    const factorValue = clamp(normalized * 2, -2, 4);
    const position = clamp(factorValue / 3, 0, 1);

    const strategyReturn = (returns[i] ?? 0) * prevPosition;
    cumReturn += strategyReturn;
    runningMax = Math.max(runningMax, cumReturn);
    const drawdown = cumReturn - runningMax;

    prevPosition = position;

    return {
      Timestamp: bar.Date,
      AssetPrice: bar.Close,
      FactorValue: factorValue,
      Position: position,
      Volatility: volatility,
      CumReturn: cumReturn,
      Drawdown: drawdown,
    };
  });
}

const toCsv = (rows: readonly OutputRow[]): string => {
  const header =
    "Timestamp,AssetPrice,FactorValue,Position,Volatility,CumReturn,Drawdown";
  const lines = rows.map(
    (row) =>
      `${row.Timestamp},${row.AssetPrice},${row.FactorValue},${row.Position},${row.Volatility},${row.CumReturn},${row.Drawdown}`,
  );
  return [header, ...lines].join("\n");
};

async function run(): Promise<void> {
  const { symbols, range, outDir } = parseArgs();
  mkdirSync(outDir, { recursive: true });

  const gateway = new YahooFinanceGateway();

  for (const symbol of symbols) {
    console.log(`📡 Fetching chart data: ${symbol} (${range})`);
    const bars = await gateway.getChart(symbol, range);
    if (bars.length === 0) {
      console.log(`⚠️ Skip ${symbol}: no bars fetched.`);
      continue;
    }

    const rows = computeRows(bars);
    const fileName = `${toCsvSafeName(symbol)}_ts.csv`;
    const outputPath = join(outDir, fileName);
    writeFileSync(outputPath, toCsv(rows), "utf8");
    console.log(`✅ Wrote ${rows.length} rows: ${outputPath}`);
  }
}

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
