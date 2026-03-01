import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AlphaKnowledgebase,
  type BacktestRunInput,
  type EventFeatureInput,
  type FeatureVersionInput,
  type MarketDailyInput,
  type SignalInput,
  type SignalLineageInput,
} from "../context/alpha_knowledgebase.ts";
import {
  getNumberArg,
  getStringArg,
  parseCliArgs,
} from "../providers/cli_args.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import {
  clamp,
  mean,
  std,
  toIsoDate,
  toSymbol4,
} from "../providers/value_normalizers.ts";
import { DataPipelineRuntime } from "../system/data_pipeline_runtime.ts";
import { paths } from "../system/path_registry.ts";

type CliArgs = {
  limit: number;
  symbols: string[];
  alphaVersion: "v1" | "v2";
  dbPath?: string;
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

const toFiniteNumber = (value: unknown, defaultValue = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
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
  const dbPathArg = getStringArg(args, "--db-path");
  const alphaVersionRaw = getStringArg(args, "--alpha-version", "v2");
  const alphaVersion = alphaVersionRaw === "v1" ? "v1" : "v2";
  const parsed: CliArgs = {
    limit,
    symbols,
    alphaVersion,
  };
  if (dbPathArg) {
    parsed.dbPath = resolve(dbPathArg);
  }
  return parsed;
};

const intelligenceMapPath = (): string =>
  join(paths.verificationRoot, "edinet_10k_intelligence_map.json");

const loadIntelligenceMap = (): IntelligenceMap => {
  const filePath = intelligenceMapPath();
  if (!existsSync(filePath)) {
    return {};
  }
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
        sentiment: clamp(toFiniteNumber(point.sentiment, 0.5), 0, 1),
        aiExposure: Math.max(0, toFiniteNumber(point.aiExposure, 0)),
        kgCentrality: Math.max(0, toFiniteNumber(point.kgCentrality, 0)),
        correctionFlag: Math.max(
          0,
          Math.min(1, Math.floor(toFiniteNumber(point.correctionFlag, 0))),
        ),
        correctionCount90d: Math.max(
          0,
          Math.floor(toFiniteNumber(point.correctionCount90d, 0)),
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
      const dateRaw = String(row.Date ?? row.date ?? "");
      const date = toIsoDate(dateRaw);
      if (!date) return null;
      const open = toFiniteNumber(row.Open, 0);
      const high = toFiniteNumber(row.High, 0);
      const low = toFiniteNumber(row.Low, 0);
      const close = toFiniteNumber(row.Close, 0);
      const volume = Math.max(0, toFiniteNumber(row.Volume, 0));
      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;
      return { date, open, high, low, close, volume };
    })
    .filter((row): row is NormalizedBar => row !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

const computeRiskScore = (point: IntelligencePoint): number => {
  const sentimentRisk = 1 - clamp(point.sentiment, 0, 1);
  const aiIntensity = Math.log1p(point.aiExposure) / 6;
  const graphComplexity = Math.log1p(point.kgCentrality) / 8;
  return sentimentRisk + aiIntensity + graphComplexity;
};

const computeForwardReturn = (
  bars: readonly NormalizedBar[],
  index: number,
  horizon: number,
): number => {
  const base = bars[index]?.close ?? 0;
  const target = bars[index + horizon]?.close ?? 0;
  if (base <= 0 || target <= 0) return 0;
  return target / base - 1;
};

const computeMaxDrawdown = (returns: readonly number[]): number => {
  let cumulative = 1;
  let runningPeak = 1;
  let worstDrawdown = 0;
  for (const r of returns) {
    cumulative *= 1 + r;
    runningPeak = Math.max(runningPeak, cumulative);
    const drawdown = cumulative / runningPeak - 1;
    worstDrawdown = Math.min(worstDrawdown, drawdown);
  }
  return worstDrawdown;
};

const featureDefinitions: readonly FeatureVersionInput[] = [
  {
    featureName: "risk_delta",
    version: "v1.0.0",
    formula:
      "risk_delta_t = risk_score_t - risk_score_t_prev_filing; risk_score = (1 - sentiment) + ln(1+ai_exposure)/6 + ln(1+kg_centrality)/8",
  },
  {
    featureName: "pead_1d",
    version: "v1.0.0",
    formula: "pead_1d_t = close_{t+1} / close_t - 1 on filing events",
  },
  {
    featureName: "pead_5d",
    version: "v1.0.0",
    formula: "pead_5d_t = close_{t+5} / close_t - 1 on filing events",
  },
  {
    featureName: "governance_penalty",
    version: "v1.0.0",
    formula: "governance_penalty_t = min(1, correction_count_90d / 3)",
  },
  {
    featureName: "revision_intensity_penalty",
    version: "v1.0.0",
    formula: "revision_intensity_penalty_t = 1 if correction_flag_t = 1 else 0",
  },
  {
    featureName: "combined_alpha",
    version: "v1.0.0",
    formula: "combined_alpha_t = -risk_delta_t + 0.6*pead_1d_t + 0.4*pead_5d_t",
  },
  {
    featureName: "combined_alpha_v2",
    version: "v2.0.0",
    formula:
      "combined_alpha_v2_t = -risk_delta_t + 0.3*pead_1d_t + 0.2*pead_5d_t - 0.2*governance_penalty_t - 0.3*revision_intensity_penalty_t",
  },
];

async function run(): Promise<void> {
  const args = parseArgs();
  const knowledgebase = new AlphaKnowledgebase(args.dbPath);
  const intelligenceMap = loadIntelligenceMap();

  for (const feature of featureDefinitions) {
    knowledgebase.upsertFeatureVersion(feature);
  }

  const runtime = new DataPipelineRuntime();
  const autoUniverse =
    args.symbols.length > 0
      ? args.symbols
      : runtime.resolveUniverse([], args.limit);
  const allSymbols = [
    ...new Set(
      [...Object.keys(intelligenceMap), ...autoUniverse].map(toSymbol4),
    ),
  ].filter((symbol) => /^\d{4}$/.test(symbol));
  const selectedSymbols = allSymbols.slice(0, args.limit);
  if (selectedSymbols.length === 0) {
    throw new Error("No symbols were selected for knowledgebase build.");
  }

  console.log(
    `📚 Building alpha knowledgebase for ${selectedSymbols.length} symbols...`,
  );

  const gateway = await MarketdataLocalGateway.create(selectedSymbols);
  let insertedMarketRows = 0;
  let insertedSignals = 0;
  let insertedEventFeatures = 0;
  const allCombinedAlphaRows: { date: string; value: number }[] = [];

  for (const symbol of selectedSymbols) {
    const barsRaw = await gateway.getBarsAll(symbol);
    const bars = normalizeBars(barsRaw);
    if (bars.length === 0) continue;

    const pointsByDate = intelligenceMap[symbol] ?? {};
    const filingDates = Object.keys(pointsByDate).sort();
    const filingDateSet = new Set(filingDates);

    for (const filingDate of filingDates) {
      const point = pointsByDate[filingDate];
      if (!point) continue;
      const docId = `EDINET-${symbol}-${filingDate.replaceAll("-", "")}`;
      const riskTermCount = Math.round(
        Math.max(
          0,
          (1 - point.sentiment) * 100 + Math.log1p(point.kgCentrality) * 10,
        ),
      );

      knowledgebase.upsertDocument({
        docId,
        symbol,
        source: "EDINET",
        filedAt: filingDate,
        title: `EDINET filing risk snapshot ${symbol} ${filingDate}`,
      });

      knowledgebase.upsertSection({
        docId,
        sectionName: "Risk Factors",
        content: `sentiment=${point.sentiment.toFixed(6)} ai_exposure=${point.aiExposure.toFixed(6)} kg_centrality=${point.kgCentrality.toFixed(6)} source=edinet_10k_intelligence_map`,
        sentiment: point.sentiment,
        riskTermCount,
        aiTermCount: Math.round(point.aiExposure),
      });
    }

    const marketRows: MarketDailyInput[] = bars.map((bar) => ({
      symbol,
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      earningsFlag: filingDateSet.has(bar.date),
    }));
    knowledgebase.upsertMarketRows(marketRows);
    insertedMarketRows += marketRows.length;

    const signals: SignalInput[] = [];
    const eventFeatures: EventFeatureInput[] = [];
    const lineage: SignalLineageInput[] = [];
    let prevRiskScore: number | null = null;

    for (const filingDate of filingDates) {
      const point = pointsByDate[filingDate];
      if (!point) continue;
      const index = bars.findIndex((bar) => bar.date === filingDate);
      if (index < 0) continue;
      if (index + 1 >= bars.length) continue;

      const riskScore = computeRiskScore(point);
      const riskDelta = prevRiskScore === null ? 0 : riskScore - prevRiskScore;
      prevRiskScore = riskScore;

      const pead1d = computeForwardReturn(bars, index, 1);
      const pead5d = computeForwardReturn(
        bars,
        index,
        Math.min(5, bars.length - index - 1),
      );
      const governancePenalty = Math.min(
        1,
        Math.max(0, point.correctionCount90d) / 3,
      );
      const revisionPenalty = point.correctionFlag > 0 ? 1 : 0;
      const combinedAlphaV1 = -riskDelta + 0.6 * pead1d + 0.4 * pead5d;
      const combinedAlphaV2 =
        -riskDelta +
        0.3 * pead1d +
        0.2 * pead5d -
        0.2 * governancePenalty -
        0.3 * revisionPenalty;
      const combinedAlpha =
        args.alphaVersion === "v1" ? combinedAlphaV1 : combinedAlphaV2;
      const signalId = `SIG-${symbol}-${filingDate.replaceAll("-", "")}`;
      const sourceDocId = `EDINET-${symbol}-${filingDate.replaceAll("-", "")}`;
      const eventId = `EVT-${symbol}-${filingDate.replaceAll("-", "")}`;

      signals.push({
        signalId,
        symbol,
        date: filingDate,
        riskDelta,
        pead1d,
        pead5d,
        combinedAlpha,
      });
      eventFeatures.push({
        eventId,
        symbol,
        filedAt: filingDate,
        docId: sourceDocId,
        riskDelta,
        sentiment: point.sentiment,
        aiExposure: point.aiExposure,
        kgCentrality: point.kgCentrality,
        correctionFlag: point.correctionFlag > 0,
        correctionCount90d: point.correctionCount90d,
        featureVersion: "edinet_event_features_v1.0.0",
      });
      lineage.push({
        signalId,
        sourceDocId,
        sourceSection: "Risk Factors",
        modelVersion:
          args.alphaVersion === "v1"
            ? "risk_delta_v1.0.0+pead_proxy_v1.0.0"
            : "risk_delta_v1.0.0+pead_proxy_v1.0.0+governance_v1.0.0",
      });
    }

    knowledgebase.upsertSignals(signals);
    knowledgebase.upsertEventFeatures(eventFeatures);
    knowledgebase.upsertSignalLineage(lineage);
    insertedSignals += signals.length;
    insertedEventFeatures += eventFeatures.length;
    for (const signal of signals) {
      allCombinedAlphaRows.push({
        date: signal.date,
        value: signal.combinedAlpha,
      });
    }
  }

  const sortedSignalRows = [...allCombinedAlphaRows].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (sortedSignalRows.length > 0) {
    const combinedReturns = sortedSignalRows.map((row) => row.value);
    const volatility = std(combinedReturns);
    const sharpe =
      volatility === 0
        ? 0
        : (mean(combinedReturns) / volatility) * Math.sqrt(252);
    const totalReturn = combinedReturns.reduce((sum, value) => sum + value, 0);
    const maxDrawdown = computeMaxDrawdown(combinedReturns);
    const firstDate = sortedSignalRows[0]?.date ?? "1970-01-01";
    const lastDate =
      sortedSignalRows[sortedSignalRows.length - 1]?.date ?? "1970-01-01";
    const run: BacktestRunInput = {
      runId: `kb-bootstrap-${Date.now()}`,
      strategyId:
        args.alphaVersion === "v1"
          ? "EDINET_RISK_DELTA_PEAD_HYBRID"
          : "EDINET_RISK_DELTA_PEAD_GOVERNANCE_V2",
      fromDate: firstDate,
      toDate: lastDate,
      sharpe,
      totalReturn,
      maxDrawdown,
    };
    knowledgebase.recordBacktestRun(run);
  }

  const counts = knowledgebase.getCounts();
  knowledgebase.close();
  console.log(
    JSON.stringify(
      {
        knowledgebase: {
          dbPath:
            args.dbPath ??
            join(paths.logsRoot, "cache", "alpha_knowledgebase.sqlite"),
          selectedSymbols: selectedSymbols.length,
          alphaVersion: args.alphaVersion,
          insertedMarketRows,
          insertedSignals,
          insertedEventFeatures,
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
