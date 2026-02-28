import { z } from "zod";
import {
  AlphaFactorsSchema,
  FinanceSnapshotSchema,
  MetricsSchema,
  Ohlc6Schema,
} from "./common_finance_schema.ts";
import { StandardOutcomeSchema } from "./standard_outcome_schema.ts";

export const ReadinessReportSchema = z.object({
  generatedAt: z.string().datetime(),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/),
    to: z.string().regex(/^\d{8}$/),
  }),
  sampleSize: z.number().int().nonnegative(),
  score: z.object({
    dataHorizon: z.number(),
    costAwareness: z.number(),
    outOfSampleDiscipline: z.number(),
    modelTraceability: z.number(),
    reproducibility: z.number(),
    executionObservability: z.number(),
    total: z.number(),
  }),
  thresholds: z.object({
    productionReadyMin: z.number(),
    cautionMin: z.number(),
  }),
  verdict: z.enum(["NOT_READY", "CAUTION", "READY"]),
  recommendations: z.array(z.string()),
});

export const SymbolAnalysisLogSchema = z.object({
  symbol: z.string().length(4),
  date: z.string().regex(/^\d{8}$/),
  ohlc6: Ohlc6Schema,
  finance: FinanceSnapshotSchema,
  factors: AlphaFactorsSchema,
  alphaScore: z.number(),
  signal: z.enum(["LONG", "HOLD"]),
  targetReturn: z.number().optional(),
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
        sharpe: z.number().optional(),
        cumulativeReturn: z.number().optional(),
        cagr: z.number().optional(),
        maxDrawdown: z.number().optional(),
        winRate: z.number().optional(),
        profitFactor: z.number().optional(),
        informationCoefficient: z.number().optional(),
        history: z.array(z.number()).optional(),
      })
      .optional(),
    executionAudit: z
      .object({
        theoreticalCostBps: z.number(),
        realizedCostBps: z.number().optional(),
        slippageImpact: z.number(),
        executionEfficiency: z.number(),
      })
      .optional(),
    proved: z.boolean(),
    selectedSymbols: z.array(z.string().length(4)),
    generatedAt: z.string().datetime(),
  }),
  execution: z.object({
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
  }),
  workflow: z.object({
    dataReadiness: z.enum(["PASS", "FAIL"]),
    alphaReadiness: z.enum(["PASS", "FAIL"]),
    verdict: z.enum(["USEFUL", "USELESS"]),
  }),
});

export const ModelReferenceLogSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  name: z.string(),
  context7LibraryId: z.string(),
  github: z.string().url(),
  arxiv: z.string().url(),
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
  schema: z.enum([
    "investor.daily-log.v1",
    "investor.benchmark-log.v1",
    "investor.readiness-report.v1",
    "investor.investment-outcome.v1",
  ]),
  generatedAt: z.string().datetime(),
  models: z.array(ModelReferenceLogSchema).optional(),
  report: z.union([
    DailyScenarioLogSchema,
    BenchmarkReportSchema,
    ReadinessReportSchema,
    StandardOutcomeSchema,
  ]),
});

export type UnifiedLog = z.infer<typeof UnifiedLogSchema>;
