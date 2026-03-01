import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  AlphaKnowledgebase,
  type SignalBacktestEvent,
} from "../context/alpha_knowledgebase.ts";
import {
  calculatePerformanceMetrics,
  QuantMetrics,
} from "../pipeline/evaluate/evaluation_metrics_core.ts";
import { core } from "../system/app_runtime_core.ts";
import { runGenericAlphaScenario } from "./scenarios/run_generic_alpha_backtest_scenario.ts";

type CliArgs = {
  topK: number;
  minSignalsPerDay: number;
  tradeLagDays: number;
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

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const pickArg = (args: readonly string[], key: string): string | undefined => {
  const prefix = `${key}=`;
  const matched = args.find((value) => value.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : undefined;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    topK: Math.max(1, Number(pickArg(args, "--top-k") ?? 3)),
    minSignalsPerDay: Math.max(
      2,
      Number(pickArg(args, "--min-signals-per-day") ?? 4),
    ),
    tradeLagDays: Math.max(1, Number(pickArg(args, "--trade-lag-days") ?? 2)),
  };

  const fromDate = pickArg(args, "--from");
  const toDate = pickArg(args, "--to");
  const dbPath = pickArg(args, "--db-path");

  if (fromDate) parsed.fromDate = fromDate;
  if (toDate) parsed.toDate = toDate;
  if (dbPath) parsed.dbPath = resolve(dbPath);
  return parsed;
};

const groupByDate = (
  events: readonly SignalBacktestEvent[],
): Map<string, SignalBacktestEvent[]> => {
  const grouped = new Map<string, SignalBacktestEvent[]>();
  for (const event of events) {
    const bucket = grouped.get(event.date) ?? [];
    bucket.push(event);
    grouped.set(event.date, bucket);
  }
  return grouped;
};

async function run(): Promise<void> {
  const args = parseArgs();
  const kb = new AlphaKnowledgebase(args.dbPath);

  const events = kb.fetchSignalBacktestEvents(
    args.fromDate,
    args.toDate,
    args.tradeLagDays,
  );
  if (events.length === 0) {
    kb.close();
    throw new Error(
      "No signal events found in selected period. Build KB first or widen date range.",
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
    strategyId: "EDINET_RISK_DELTA_PEAD_HYBRID",
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

  await runGenericAlphaScenario({
    strategyId: "EDINET_RISK_DELTA_PEAD_HYBRID",
    strategyName: "EDINET Risk-Delta x PEAD Hybrid (KB)",
    summary:
      "Long top combined_alpha and short bottom combined_alpha on filing-event days sourced from AlphaKnowledgebase signals.",
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
      productionReady,
    },
  };

  kb.close();
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
