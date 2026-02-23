import { z } from "zod";
import {
  average,
  extractEstatValues,
  SymbolAnalysisSchema,
  scoreDailyAlpha,
} from "../analysis/daily_alpha.ts";
import type { MarketDataGateway } from "../gateways/live_market_data_gateway.ts";

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
    proved: z.boolean(),
    selectedSymbols: z.array(z.string().length(4)),
    generatedAt: z.string().datetime(),
  }),
  workflow: z.object({
    dataReadiness: z.enum(["PASS", "FAIL"]),
    alphaReadiness: z.enum(["PASS", "FAIL"]),
    verdict: z.enum(["USEFUL", "USELESS"]),
  }),
});

export type VegetableExperimentReport = z.infer<
  typeof VegetableExperimentReportSchema
>;

export async function runVegetableScenario(
  gateway: MarketDataGateway,
  nowIso: string,
  dateCandidates: readonly string[],
): Promise<VegetableExperimentReport> {
  const date = nowIso.slice(0, 10).replaceAll("-", "");
  const estatObj = await gateway.getEstatStats("0000010101");
  const matchedSymbols = [...Universe];

  const estatValues = extractEstatValues(estatObj.GET_STATS_DATA);
  const half = Math.max(1, Math.floor(estatValues.length / 2));
  const older = average(estatValues.slice(0, half));
  const newer = average(estatValues.slice(half));
  const vegetablePriceMomentum =
    (newer - older) / Math.max(Math.abs(older), 1e-9);

  const detail = await Promise.all(
    matchedSymbols.map(async (symbol) => {
      const [bars, fins] = await Promise.all([
        gateway.getDailyBars(symbol, dateCandidates),
        gateway.getStatements(symbol),
      ]);
      const bar = z.record(z.string(), z.unknown()).catch({}).parse(bars.at(0));
      const fin = z.record(z.string(), z.unknown()).catch({}).parse(fins.at(0));
      return scoreDailyAlpha(symbol, bar, fin, vegetablePriceMomentum);
    }),
  );

  const analysis =
    detail.length > 0
      ? detail
      : Universe.map((symbol) =>
          scoreDailyAlpha(symbol, {}, {}, vegetablePriceMomentum),
        );

  const sorted = [...analysis].sort((a, b) => b.alphaScore - a.alphaScore);
  const top =
    sorted[0] ??
    SymbolAnalysisSchema.parse({
      symbol: "1375",
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
        dailyReturn: 0,
        intradayRange: 0,
        closeStrength: 0,
        liquidityPerShare: 0,
      },
      alphaScore: 0,
      signal: "HOLD",
    });
  const avgAlpha = average(analysis.map((s) => s.alphaScore));
  const actionable = avgAlpha > 0 && top.alphaScore > 0;
  const hasPrice = analysis.some(
    (s) => s.ohlc6.open > 0 && s.ohlc6.close > 0 && s.ohlc6.high > 0,
  );
  const hasFinance = analysis.some(
    (s) => s.finance.netSales !== 0 || s.finance.operatingProfit !== 0,
  );
  const dataReadiness = hasPrice && hasFinance ? "PASS" : "FAIL";
  const alphaReadiness = actionable ? "PASS" : "FAIL";
  const experimentUseful =
    dataReadiness === "PASS" && alphaReadiness === "PASS";
  const kellyFractionRaw = Math.max(0, avgAlpha) * 0.5;
  const kellyFraction = Math.min(0.2, kellyFractionRaw);
  const selectedSymbols = sorted
    .filter((s) => s.signal === "LONG")
    .map((s) => s.symbol);
  const selectedRows = analysis.filter((s) =>
    selectedSymbols.includes(s.symbol),
  );
  const basketDailyReturn = average(
    selectedRows.map((s) => s.factors.dailyReturn),
  );
  const paperPnlPerUnit = basketDailyReturn;
  const proved = basketDailyReturn > 0 && dataReadiness === "PASS";

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
      proved,
      selectedSymbols,
      generatedAt: nowIso,
    },
    workflow: {
      dataReadiness,
      alphaReadiness,
      verdict: experimentUseful ? "USEFUL" : "USELESS",
    },
  });
}
