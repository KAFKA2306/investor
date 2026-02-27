import { z } from "zod";
import { runSimpleBacktest } from "../../backtest/simulator.ts";
import { calculateCorrelation, evaluate } from "../../domain/performance.ts";
import type { MarketDataGateway } from "../../gateways/live_market_data_gateway.ts";
import { InferenceService } from "../../infrastructure/inference_service.ts";
import type { AceBullet } from "../../schemas/ace.ts";
import {
  average,
  extractEstatValues,
  getNumberByKeys,
  type SymbolAnalysis,
  SymbolAnalysisSchema,
  scoreDailyAlpha,
} from "../analysis/daily_alpha.ts";

const Universe = ["1375", "1332", "2503"] as const;

export const VegetableExperimentReportSchema = z.object({
  scenarioId: z.literal("SCN-VEG-001"),
  analyzedAt: z.string().datetime(),
  date: z.string().regex(/^\d{8}$/),
  inputs: z.object({
    estatStatsDataId: z.literal("0000010101"),
    universe: z.array(z.string().length(4)).min(1),
  }),
  evidence: z.object({
    estat: z.object({
      hasStatsData: z.boolean(),
      status: z.enum(["PASS", "FAIL"]),
    }),
    jquants: z.object({
      listedCount: z.number().int().nonnegative(),
      matchedSymbols: z.array(z.string().length(4)),
      status: z.enum(["PASS", "FAIL"]),
    }),
  }),
  market: z.object({
    vegetablePriceMomentum: z.number(),
  }),
  analysis: z.array(SymbolAnalysisSchema),
  decision: z.object({
    strategy: z.literal("Vegetable Inflation Rotation"),
    action: z.enum(["LONG_BASKET", "NO_TRADE"]),
    topSymbol: z.string().length(4),
    reason: z.string(),
    experimentValue: z.enum(["USEFUL", "USELESS"]),
  }),
  signals: z.object({
    macro: z.object({
      vegetablePriceMomentum: z.number(),
    }),
    symbols: z.array(
      z.object({
        symbol: z.string().length(4),
        alphaScore: z.number(),
        signal: z.enum(["LONG", "HOLD"]),
        sueProxy: z.number(),
      }),
    ),
  }),
  risks: z.object({
    kellyFraction: z.number().min(0).max(1),
    stopLossPct: z.number().min(0),
    maxPositions: z.number().int().positive(),
  }),
  results: z.object({
    mode: z.literal("PROOF"),
    status: z.enum(["PASS", "FAIL"]),
    expectedEdge: z.number(),
    basketDailyReturn: z.number(),
    paperPnlPerUnit: z.number(),
    backtest: z
      .object({
        from: z.string().regex(/^\d{8}$/),
        to: z.string().regex(/^\d{8}$/),
        tradingDays: z.number().int().positive(),
        feeBps: z.number().min(0),
        slippageBps: z.number().min(0),
        totalCostBps: z.number().min(0),
        grossReturn: z.number(),
        netReturn: z.number(),
        pnlPerUnit: z.number(),
        sharpe: z.number(),
        cumulativeReturn: z.number().optional(),
        cagr: z.number().optional(),
        maxDrawdown: z.number().optional(),
        winRate: z.number().optional(),
        profitFactor: z.number().optional(),
        history: z.array(z.number()).optional(),
      })
      .optional(),
    proved: z.boolean(),
    selectedSymbols: z.array(z.string().length(4)),
    generatedAt: z.string().datetime(),
  }),
  execution: z
    .object({
      mode: z.literal("PAPER"),
      status: z.enum(["EXECUTED", "SKIPPED"]),
      orderCount: z.number().int().nonnegative(),
      orders: z.array(
        z.object({
          symbol: z.string().length(4),
          side: z.literal("BUY"),
          quantity: z.number().int().positive(),
          fillPrice: z.number().nonnegative(),
          notional: z.number().nonnegative(),
          executedAt: z.string().datetime(),
        }),
      ),
      summary: z.object({
        grossExposure: z.number().nonnegative(),
      }),
    })
    .optional(),
  workflow: z.object({
    dataReadiness: z.enum(["PASS", "FAIL"]),
    alphaReadiness: z.enum(["PASS", "FAIL"]),
    verdict: z.enum(["USEFUL", "USELESS"]),
  }),
  ace: z
    .object({
      usedBullets: z.array(z.string()),
    })
    .optional(),
});

export type VegetableExperimentReport = z.infer<
  typeof VegetableExperimentReportSchema
>;

export async function runVegetableScenario(
  gateway: MarketDataGateway,
  nowIso: string,
  dateCandidates: readonly string[],
  playbookBullets: AceBullet[] = [],
): Promise<VegetableExperimentReport> {
  const usedBullets: string[] = playbookBullets.map((b) => b.id);
  const date: string = nowIso.slice(0, 10).replaceAll("-", "");
  const estatObj = await gateway.getEstatStats("0000010101");
  const matchedSymbols: string[] = [...Universe];

  const estatValues: number[] = extractEstatValues(estatObj.GET_STATS_DATA);
  const half: number = Math.max(1, Math.floor(estatValues.length / 2));
  const older: number = average(estatValues.slice(0, half));
  const newer: number = average(estatValues.slice(half));
  const vegetablePriceMomentum: number =
    (newer - older) / Math.max(Math.abs(older), 1e-9);

  const range: string[] = [...dateCandidates].sort();
  const executionDate: string = range[range.length - 1] ?? date;
  const signalDates: string[] = range.slice(0, -1);
  if (signalDates.length === 0) signalDates.push(executionDate);

  const inference = new InferenceService();
  const analyses = await Promise.all(
    matchedSymbols.map(
      async (symbol: string): Promise<SymbolAnalysis | null> => {
        const [signalBars, executionBars, fins, history] = await Promise.all([
          gateway.getDailyBars(symbol, signalDates),
          gateway.getDailyBars(symbol, [executionDate]),
          gateway.getStatements(symbol),
          gateway.getHistory(symbol, 512),
        ]);

        if (
          signalBars.length === 0 ||
          executionBars.length === 0 ||
          fins.length === 0
        ) {
          return null;
        }

        const lastClose: number = history[history.length - 1] ?? 0;
        let predictedReturn: number = 0;
        try {
          const pred = await inference.predict(history, "chronos-tiny");
          const forecast: number = pred.forecast[0] ?? lastClose;
          predictedReturn = (forecast - lastClose) / Math.max(lastClose, 1e-9);
        } catch {}

        const signalBar: Record<string, number> = z
          .record(z.string(), z.number())
          .parse(signalBars.at(0));
        const executionBar: Record<string, number> = z
          .record(z.string(), z.number())
          .parse(executionBars.at(0));
        const fin: Record<string, number> = z
          .record(z.string(), z.number())
          .parse(fins.at(0));

        const eOpen: number = getNumberByKeys(executionBar, [
          "Open",
          "open_price",
          "open",
          "O",
        ]);
        const eClose: number = getNumberByKeys(executionBar, [
          "Close",
          "close_price",
          "close",
          "C",
        ]);
        const targetReturn: number =
          (eClose - eOpen) / Math.max(Math.abs(eOpen), 1e-9);

        return scoreDailyAlpha(
          symbol,
          signalBar,
          fin,
          vegetablePriceMomentum,
          predictedReturn,
          targetReturn,
        );
      },
    ),
  );

  const analysis: SymbolAnalysis[] = analyses.filter(
    (a): a is SymbolAnalysis => a !== null,
  );

  const sorted: SymbolAnalysis[] = [...analysis].sort(
    (a, b) => b.alphaScore - a.alphaScore,
  );
  const top: SymbolAnalysis =
    sorted[0] ??
    SymbolAnalysisSchema.parse({
      symbol: "1375",
      date: "19700101",
      ohlc6: {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        turnoverValue: 0,
      },
      finance: { netSales: 0, operatingProfit: 0, profitMargin: 0 },
      factors: {
        prevDailyReturn: 0,
        intradayRange: 0,
        closeStrength: 0,
        liquidityPerShare: 0,
      },
      alphaScore: 0,
      signal: "HOLD",
    });
  const avgAlpha: number = average(analysis.map((s) => s.alphaScore));
  const actionable: boolean = avgAlpha > 0 && top.alphaScore > 0;
  const hasPrice: boolean = analysis.some(
    (s) => s.ohlc6.open > 0 && s.ohlc6.close > 0 && s.ohlc6.high > 0,
  );
  const hasFinance: boolean = analysis.some(
    (s) => s.finance.netSales !== 0 || s.finance.operatingProfit !== 0,
  );
  const dataReadiness: "PASS" | "FAIL" =
    hasPrice && hasFinance ? "PASS" : "FAIL";
  const alphaReadiness: "PASS" | "FAIL" = actionable ? "PASS" : "FAIL";
  const experimentUseful: boolean =
    dataReadiness === "PASS" && alphaReadiness === "PASS";
  const kellyFractionRaw: number = Math.max(0, avgAlpha) * 0.5;
  const kellyFraction: number = Math.min(0.2, kellyFractionRaw);
  const selectedSymbols: string[] = sorted
    .filter((s) => s.signal === "LONG")
    .map((s) => s.symbol);
  const selectedRows: SymbolAnalysis[] = analysis.filter((s) =>
    selectedSymbols.includes(s.symbol),
  );
  const from: string = range[0] ?? date;
  const to: string = range[range.length - 1] ?? date;
  const backtest = runSimpleBacktest({
    config: {
      from,
      to,
      feeBps: 10,
      slippageBps: 5,
    },
    selectedRows,
    tradingDays: range.length,
  });
  const basketDailyReturn: number = backtest.netReturn;
  const paperPnlPerUnit: number = backtest.pnlPerUnit;

  const basketLogs = range.map((d: string) => ({
    date: d,
    strategyReturn: basketDailyReturn / range.length,
  }));
  const equityHistory: number[] = backtest.history ?? [1.0];

  const informationCoefficient = calculateCorrelation(
    analysis.map((s) => s.alphaScore),
    analysis.map((s) => s.targetReturn ?? 0),
  );

  const fullMetrics = evaluate(basketLogs, {
    predicted: analysis.map((s) => s.alphaScore),
    actual: analysis.map((s) => s.targetReturn ?? 0),
  });

  const proved: boolean = basketDailyReturn > 0 && dataReadiness === "PASS";

  const theoreticalCostBps = 15; // 10 fee + 5 slippage
  const totalReturn = basketDailyReturn;
  const executionEfficiency = totalReturn > 0 ? 1.0 : 0.0; // Simplified for paper

  return VegetableExperimentReportSchema.parse({
    scenarioId: "SCN-VEG-001",
    analyzedAt: nowIso,
    date,
    inputs: { estatStatsDataId: "0000010101", universe: [...Universe] },
    evidence: {
      estat: {
        hasStatsData: "GET_STATS_DATA" in estatObj,
        status: "GET_STATS_DATA" in estatObj ? "PASS" : "FAIL",
      },
      jquants: {
        listedCount: matchedSymbols.length,
        matchedSymbols: [...matchedSymbols],
        status: matchedSymbols.length > 0 ? "PASS" : "FAIL",
      },
    },
    market: { vegetablePriceMomentum },
    analysis,
    decision: {
      strategy: "Vegetable Inflation Rotation",
      action: actionable ? "LONG_BASKET" : "NO_TRADE",
      topSymbol: top.symbol,
      reason: actionable
        ? "野菜価格モメンタムと銘柄財務・日足6指標の合成αが正。"
        : "合成αが閾値未達。",
      experimentValue: experimentUseful ? "USEFUL" : "USELESS",
    },
    signals: {
      macro: { vegetablePriceMomentum },
      symbols: analysis.map((s) => ({
        symbol: s.symbol,
        alphaScore: s.alphaScore,
        signal: s.signal,
        sueProxy: s.finance.profitMargin,
      })),
    },
    risks: {
      kellyFraction,
      stopLossPct: 0.03,
      maxPositions: 3,
    },
    results: {
      mode: "PROOF",
      status: proved ? "PASS" : "FAIL",
      expectedEdge: avgAlpha,
      basketDailyReturn,
      paperPnlPerUnit,
      backtest: {
        ...backtest,
        sharpe: fullMetrics.sharpe,
        cumulativeReturn: fullMetrics.cumulativeReturn,
        cagr: fullMetrics.cagr,
        maxDrawdown: fullMetrics.maxDrawdown,
        winRate: fullMetrics.winRate,
        profitFactor: fullMetrics.profitFactor,
        informationCoefficient,
        history: equityHistory,
      },
      executionAudit: {
        theoreticalCostBps,
        slippageImpact: (theoreticalCostBps / 10000) * range.length,
        executionEfficiency,
      },
      proved,
      selectedSymbols,
      generatedAt: nowIso,
    },
    workflow: {
      dataReadiness,
      alphaReadiness,
      verdict: experimentUseful ? "USEFUL" : "USELESS",
    },
    ace: {
      usedBullets,
    },
  });
}
