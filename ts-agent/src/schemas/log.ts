import { z } from "zod";

export const ModelReferenceLogSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  name: z.string(),
  context7LibraryId: z.string(),
  github: z.string().url(),
  arxiv: z.string().url(),
});

export const Ohlc6Schema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  turnoverValue: z.number(),
});

export const FinanceSnapshotSchema = z.object({
  netSales: z.number(),
  operatingProfit: z.number(),
  profitMargin: z.number(),
});

export const AlphaFactorsSchema = z.object({
  dailyReturn: z.number(),
  intradayRange: z.number(),
  closeStrength: z.number(),
  liquidityPerShare: z.number(),
});

export const SymbolAnalysisLogSchema = z.object({
  symbol: z.string().length(4),
  ohlc6: Ohlc6Schema,
  finance: FinanceSnapshotSchema,
  factors: AlphaFactorsSchema,
  alphaScore: z.number(),
  signal: z.enum(["LONG", "HOLD"]),
});

export const DailyScenarioLogSchema = z.object({
  scenarioId: z.string(),
  analyzedAt: z.string().datetime(),
  date: z.string().regex(/^\d{8}$/),
  inputs: z.object({
    estatStatsDataId: z.string(),
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
  analysis: z.array(SymbolAnalysisLogSchema),
  decision: z.object({
    strategy: z.string(),
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

export const MetricsSchema = z.object({
  mae: z.number(),
  rmse: z.number(),
  smape: z.number(),
  directionalAccuracy: z.number(),
  tStat: z.number().optional(), // Statistical significance of alpha
  pValue: z.number().optional(), // Probability of results due to luck
  sharpeRatio: z.number().optional(), // Risk-adjusted return
});

export const BenchmarkReportSchema = z.object({
  type: z.literal("FOUNDATION_BENCHMARK"),
  benchmarkId: z.string(),
  date: z.string().regex(/^\d{8}$/),
  analyst: z.object({
    baselines: z.array(
      z.object({
        name: z.string(),
        metrics: MetricsSchema,
      }),
    ),
    models: z.array(
      z.object({
        id: z.string(),
        vendor: z.string(),
        tags: z.array(z.string()),
      }),
    ),
    recommendations: z.array(z.string()),
    insights: z.string(),
  }),
  operator: z.object({
    status: z.enum(["PASS", "FAIL"]),
    dataset: z.string(),
    rowCount: z.number(),
    environment: z.string(),
    workflowReadiness: z.enum(["PASS", "FAIL"]),
  }),
  debugger: z.object({
    telemetry: z.record(z.string(), z.unknown()),
    envCheck: z.record(z.string(), z.boolean()),
    rawValues: z.array(z.number()),
    latencyMs: z.number().optional(),
  }),
});

export const UnifiedLogSchema = z.object({
  schema: z.enum(["investor.daily-log.v1", "investor.benchmark-log.v1"]),
  generatedAt: z.string().datetime(),
  models: z.array(ModelReferenceLogSchema),
  report: z.union([DailyScenarioLogSchema, BenchmarkReportSchema]),
});

export type UnifiedLog = z.infer<typeof UnifiedLogSchema>;
