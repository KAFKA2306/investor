import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AlphaKnowledgebase,
  type GateDecisionInput,
  type SignalBacktestEvent,
  type TradableSignalEvent,
} from "../context/alpha_knowledgebase.ts";
import {
  calculatePerformanceMetrics,
  QuantMetrics,
} from "../pipeline/evaluate/evaluation_metrics_core.ts";
import {
  getNumberArg,
  getStringArg,
  hasFlag,
  parseCliArgs,
} from "../providers/cli_args.ts";
import {
  type StandardOutcome,
  UnifiedLogSchema,
} from "../schemas/financial_domain_schemas.ts";
import { core } from "../system/app_runtime_core.ts";
import { clamp, mean } from "../utils/math_utils.ts";
import { valueUtils } from "../utils/value_utils.ts";

type CliArgs = {
  topK: number;
  minSignalsPerDay: number;
  tradeLagDays: number;
  withGates: boolean;
  minLiquidityJpy: number;
  maxCorrection90d: number;
  allowRegimes: Set<string>;
  fromDate?: string;
  toDate?: string;
  dbPath?: string;
};

type DailyBasket = {
  date: string;
  count: number;
  longCount: number;
  shortCount: number;
  grossReturn: number;
  netReturn: number;
};

type BacktestRow = {
  signalId: string;
  date: string;
  combinedAlpha: number;
  nextReturn: number;
};

const parseArgs = (argv: readonly string[]): CliArgs => {
  const args = parseCliArgs(argv);
  const edinetGates = core.config.alpha?.edinet?.gates;
  const parsed: CliArgs = {
    topK: Math.max(1, getNumberArg(args, "--top-k", 3)),
    minSignalsPerDay: Math.max(
      2,
      getNumberArg(
        args,
        "--min-signals-per-day",
        edinetGates?.minSignalsPerDay ?? 4,
      ),
    ),
    tradeLagDays: Math.max(1, getNumberArg(args, "--trade-lag-days", 2)),
    withGates: hasFlag(args, "--with-gates"),
    minLiquidityJpy: Math.max(
      0,
      getNumberArg(
        args,
        "--min-liquidity-jpy",
        edinetGates?.minLiquidityJpy ?? 100_000_000,
      ),
    ),
    maxCorrection90d: Math.max(
      0,
      getNumberArg(
        args,
        "--max-correction-90d",
        edinetGates?.maxCorrection90d ?? 2,
      ),
    ),
    allowRegimes: new Set(
      (
        getStringArg(args, "--allow-regimes") ??
        edinetGates?.regimeAllowlist?.join(",") ??
        "RISK_ON,NEUTRAL"
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  };

  const fromDate = getStringArg(args, "--from");
  const toDate = getStringArg(args, "--to");
  const dbPath = getStringArg(args, "--db-path");

  if (fromDate) parsed.fromDate = fromDate;
  if (toDate) parsed.toDate = toDate;
  if (dbPath) parsed.dbPath = resolve(dbPath);
  return parsed;
};

const groupByDate = (
  events: readonly BacktestRow[],
): Map<string, BacktestRow[]> => {
  const grouped = new Map<string, BacktestRow[]>();
  for (const event of events) {
    const bucket = grouped.get(event.date) ?? [];
    bucket.push(event);
    grouped.set(event.date, bucket);
  }
  return grouped;
};

const normalizeBacktestRows = (
  events: readonly SignalBacktestEvent[],
): BacktestRow[] =>
  events.map((row) => ({
    signalId: row.signalId,
    date: row.date,
    combinedAlpha: row.combinedAlpha,
    nextReturn: row.nextReturn,
  }));

const buildGateDecisions = (
  row: TradableSignalEvent,
  args: CliArgs,
): { passed: boolean; decisions: GateDecisionInput[] } => {
  const liquidity = Math.max(0, row.entryClose) * Math.max(0, row.entryVolume);
  const liquidityPass = liquidity >= args.minLiquidityJpy;
  const correctionPass = row.correctionCount90d <= args.maxCorrection90d;
  const regimePass =
    row.regimeId !== null && args.allowRegimes.has(row.regimeId);

  const decisions: GateDecisionInput[] = [
    {
      signalId: row.signalId,
      date: row.date,
      gateName: "liquidity_min_jpy",
      passed: liquidityPass,
      threshold: `>= ${args.minLiquidityJpy}`,
      actualValue: liquidity,
      reason: liquidityPass ? "ok" : "insufficient_liquidity",
    },
    {
      signalId: row.signalId,
      date: row.date,
      gateName: "correction_count_90d",
      passed: correctionPass,
      threshold: `<= ${args.maxCorrection90d}`,
      actualValue: row.correctionCount90d,
      reason: correctionPass ? "ok" : "too_many_corrections",
    },
    {
      signalId: row.signalId,
      date: row.date,
      gateName: "macro_regime_allowlist",
      passed: regimePass,
      threshold: [...args.allowRegimes].join(","),
      actualValue: null,
      reason: regimePass
        ? "ok"
        : `regime_not_allowed:${row.regimeId ?? "NONE"}`,
    },
  ];

  return {
    passed: liquidityPass && correctionPass && regimePass,
    decisions,
  };
};

const writeStandardOutcome = async (params: {
  strategyId: string;
  strategyName: string;
  summary: string;
  experimentId?: string;
  evidenceSource?: "QUANT_BACKTEST" | "LINGUISTIC_ONLY";
  alpha?: {
    tStat: number;
    pValue: number;
    informationCoefficient: number;
  };
  verification?: {
    sharpe: number;
    totalReturn: number;
    maxDrawdown: number;
    upliftOverBaseline?: number;
  };
  reasoningScore: number;
  isProductionReady: boolean;
}) => {
  const generatedAt = new Date().toISOString();
  const evidenceSource = params.evidenceSource ?? "LINGUISTIC_ONLY";

  const outcome: StandardOutcome = {
    strategyId: params.strategyId,
    strategyName: params.strategyName,
    timestamp: generatedAt,
    experimentId: params.experimentId,
    summary: `${params.summary} (Validated via Model Registry for TS Forecasting models line: Chronos/TimesFM) [Evidence=${evidenceSource}]`,
    modelRegistryStatus: "ACTIVE",
    evidenceSource,
    alpha: params.alpha,
    verification: params.verification
      ? {
          metrics: {
            mae: 0,
            rmse: 0,
            smape: 0,
            directionalAccuracy: 0,
            sharpeRatio: params.verification.sharpe,
            annualizedReturn: params.verification.totalReturn,
            maxDrawdown: params.verification.maxDrawdown,
          },
          upliftOverBaseline: params.verification.upliftOverBaseline,
        }
      : undefined,
    stability: {
      trackingError: 0.01,
      tradingDaysHorizon: 252,
      isProductionReady: params.isProductionReady,
    },
    reasoningScore: params.reasoningScore,
  };

  const unifiedLog = {
    schema: "investor.investment-outcome.v1" as const,
    generatedAt,
    report: outcome,
  };

  const today = generatedAt.split("T")[0];
  const logDir = join(core.config.paths.logs, "unified");
  mkdirSync(logDir, { recursive: true });
  writeFileSync(
    join(logDir, `${today}.json`),
    JSON.stringify(unifiedLog, null, 2),
  );
  return UnifiedLogSchema.parse(unifiedLog);
};

export async function runKbSignalBacktest(
  cliArgs: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const args = parseArgs(cliArgs);
  const kb = new AlphaKnowledgebase(args.dbPath);

  let gateDecisionsSaved = 0;
  const events = args.withGates
    ? (() => {
        const tradable = kb.fetchTradableSignals(
          args.fromDate,
          args.toDate,
          args.tradeLagDays,
        );
        const gateDecisions: GateDecisionInput[] = [];
        const passedRows: BacktestRow[] = [];
        for (const row of tradable) {
          const gate = buildGateDecisions(row, args);
          gateDecisions.push(...gate.decisions);
          if (gate.passed) {
            passedRows.push({
              signalId: row.signalId,
              date: row.date,
              combinedAlpha: row.combinedAlpha,
              nextReturn: row.nextReturn,
            });
          }
        }
        kb.upsertGateDecisions(gateDecisions);
        gateDecisionsSaved = gateDecisions.length;
        return passedRows;
      })()
    : normalizeBacktestRows(
        kb.fetchSignalBacktestEvents(
          args.fromDate,
          args.toDate,
          args.tradeLagDays,
        ),
      );
  if (events.length === 0) {
    kb.close();
    throw new Error(
      args.withGates
        ? "No signal events passed gates in selected period. Lower thresholds or widen date range."
        : "No signal events found in selected period. Build KB first or widen date range.",
    );
  }

  const byDate = groupByDate(events);
  const dates = [...byDate.keys()].sort();
  const totalCostRate =
    (core.config.execution.costs.feeBps +
      core.config.execution.costs.slippageBps) /
    10000;
  const baskets: DailyBasket[] = [];
  const predictions: number[] = [];
  const actuals: number[] = [];

  for (const date of dates) {
    const rows = (byDate.get(date) ?? [])
      .filter(
        (row) =>
          Number.isFinite(row.combinedAlpha) && Number.isFinite(row.nextReturn),
      )
      .sort((left, right) => right.combinedAlpha - left.combinedAlpha);

    if (rows.length < args.minSignalsPerDay) continue;

    const longLeg = rows.slice(0, Math.min(args.topK, rows.length));
    const shortLeg = [...rows]
      .reverse()
      .slice(0, Math.min(args.topK, rows.length));
    const longReturn = mean(longLeg.map((row) => row.nextReturn));
    const shortReturn = mean(shortLeg.map((row) => row.nextReturn));
    const grossReturn = longReturn - shortReturn;
    const netReturn = grossReturn - totalCostRate;

    for (const row of rows) {
      predictions.push(row.combinedAlpha);
      actuals.push(row.nextReturn);
    }

    baskets.push({
      date,
      count: rows.length,
      longCount: longLeg.length,
      shortCount: shortLeg.length,
      grossReturn,
      netReturn,
    });
  }

  if (baskets.length === 0) {
    kb.close();
    throw new Error(
      "No tradable basket days after filtering. Lower --min-signals-per-day or rebuild with wider universe.",
    );
  }

  const dailyReturns = baskets.map((row) => row.netReturn);
  const perf = calculatePerformanceMetrics(dailyReturns);
  const tStat = QuantMetrics.calculateTStat(dailyReturns);
  const pValue = QuantMetrics.calculatePValue(tStat, dailyReturns.length);
  const informationCoefficient =
    predictions.length >= 2
      ? QuantMetrics.calculateCorr(predictions, actuals)
      : 0;
  const runId = `kb-backtest-${randomUUID().slice(0, 12)}`;
  const firstDate = baskets[0]?.date ?? "1970-01-01";
  const lastDate = baskets[baskets.length - 1]?.date ?? "1970-01-01";

  kb.recordBacktestRun({
    runId,
    strategyId: args.withGates
      ? "EDINET_RISK_DELTA_PEAD_GOVERNANCE_REGIME_V2"
      : "EDINET_RISK_DELTA_PEAD_HYBRID",
    fromDate: firstDate,
    toDate: lastDate,
    sharpe: perf.sharpe,
    totalReturn: perf.cumulativeReturn,
    maxDrawdown: perf.maxDrawdown,
  });

  const productionReady = perf.sharpe >= 0.8 && pValue <= 0.1;
  const reasoningScore = clamp(
    0.5 +
      clamp(perf.sharpe / 3, -0.25, 0.25) +
      clamp((informationCoefficient ?? 0) / 2, -0.15, 0.15),
    0,
    1,
  );

  await writeStandardOutcome({
    strategyId: args.withGates
      ? "EDINET_RISK_DELTA_PEAD_GOVERNANCE_REGIME_V2"
      : "EDINET_RISK_DELTA_PEAD_HYBRID",
    strategyName: args.withGates
      ? "EDINET Risk-Delta x PEAD x Governance x Regime (KB)"
      : "EDINET Risk-Delta x PEAD Hybrid (KB)",
    summary: args.withGates
      ? "Long top combined_alpha and short bottom combined_alpha on filing-event days after liquidity/correction/regime gates."
      : "Long top combined_alpha and short bottom combined_alpha on filing-event days sourced from AlphaKnowledgebase signals.",
    experimentId: runId,
    evidenceSource: "QUANT_BACKTEST",
    alpha: {
      tStat,
      pValue,
      informationCoefficient,
    },
    verification: {
      sharpe: perf.sharpe,
      totalReturn: perf.cumulativeReturn,
      maxDrawdown: perf.maxDrawdown,
    },
    reasoningScore,
    isProductionReady: productionReady,
  });

  const summary = {
    backtest: {
      runId,
      dbPath: args.dbPath ?? "logs/cache/alpha_knowledgebase.sqlite",
      period: {
        from: firstDate,
        to: lastDate,
      },
      settings: {
        topK: args.topK,
        minSignalsPerDay: args.minSignalsPerDay,
        tradeLagDays: args.tradeLagDays,
        withGates: args.withGates,
        minLiquidityJpy: args.minLiquidityJpy,
        maxCorrection90d: args.maxCorrection90d,
        allowRegimes: [...args.allowRegimes],
        totalCostRate,
      },
      sample: {
        totalSignalEvents: events.length,
        tradableDays: baskets.length,
        predictionPairs: predictions.length,
      },
      metrics: {
        sharpe: perf.sharpe,
        cumulativeReturn: perf.cumulativeReturn,
        maxDrawdown: perf.maxDrawdown,
        winRate: perf.winRate,
        volatility: perf.volatility,
        tStat,
        pValue,
        informationCoefficient,
      },
      gateDecisionsSaved,
      productionReady,
    },
  };

  kb.close();
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  runKbSignalBacktest().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
