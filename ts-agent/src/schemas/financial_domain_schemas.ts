import { z } from "zod";

/**
 * Common Financial Data Structures
 */
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
  prevDailyReturn: z.number(),
  intradayRange: z.number(),
  closeStrength: z.number(),
  liquidityPerShare: z.number(),
});

export const MetricsSchema = z.object({
  mae: z.number(),
  rmse: z.number(),
  smape: z.number(),
  directionalAccuracy: z.number(),
  tStat: z.number().optional(),
  pValue: z.number().optional(),
  sharpeRatio: z.number().optional(),
  maxDrawdown: z.number().optional(),
  annualizedReturn: z.number().optional(),
  abstentionRate: z.number().optional(),
  safeAccuracy: z.number().optional(),
  overconfidenceError: z.number().optional(),
  brierScore: z.number().optional(),
  ece: z.number().optional(),
  premiseCoverage: z.number().optional(),
});

export type Metrics = z.infer<typeof MetricsSchema>;

/**
 * PEAD (Post-Earnings Announcement Drift) Domain Schemas
 */
export const CalendarEntrySchema = z.object({
  code: z.string().length(4),
});

export const FinancialStatementSchema = z.object({
  LocalCode: z.string().length(4),
  NetIncome: z.number(),
  NetSales: z.number(),
});

export const DailyQuoteSchema = z.object({
  Date: z.string(),
  Code: z.string(),
  Open: z.number().nullable(),
  High: z.number().nullable(),
  Low: z.number().nullable(),
  Close: z.number().nullable(),
  Volume: z.number().nullable(),
  AdjustmentClose: z.number().nullable(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
export type DailyQuote = z.infer<typeof DailyQuoteSchema>;

/**
 * ACE (Agentic Context Engineering) Playbook Schema
 * Based on ArXiv 2510.04618 and JRay-Lin/ace-agents
 */
export const AceBulletSchema = z.object({
  id: z.string(),
  content: z.string(),
  section: z.enum([
    "strategies_and_hard_rules",
    "insights",
    "evidence",
    "domain_knowledge",
  ]),
  helpful_count: z.number().default(0),
  harmful_count: z.number().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AcePlaybookSchema = z.object({
  bullets: z.array(AceBulletSchema),
});

export type AceBullet = z.infer<typeof AceBulletSchema>;
export type AcePlaybook = z.infer<typeof AcePlaybookSchema>;

/**
 * Alpha-R1: Strategic Reasoning and Screening
 * Based on arXiv:2512.23515
 */
export const StrategicReasoningSchema = z.object({
  rationale: z.string(),
  logicChecks: z.array(
    z.object({
      claim: z.string(),
      verdict: z.enum(["VALID", "INVALID", "UNCERTAIN"]),
      evidence: z.string().optional(),
    }),
  ),
  contextAlignment: z.number().min(0).max(1),
  marketRegime: z.string(),
});

export const AlphaScreeningSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "DECAYED"]),
  reason: z.string(),
  lastUpdated: z.string().datetime(),
  score: z.number().min(0).max(1),
});

export type StrategicReasoning = z.infer<typeof StrategicReasoningSchema>;
export type AlphaScreening = z.infer<typeof AlphaScreeningSchema>;

/**
 * Standard Outcome and Alpha Significance
 */
export const AlphaSignificanceSchema = z.object({
  tStat: z.number().optional(),
  pValue: z.number().min(0).max(1).optional(),
  informationCoefficient: z.number().min(-1).max(1).optional(),
  factorStability: z.number().optional(),
  numerai: z
    .object({
      corr: z.number().min(-1).max(1).optional(),
      mmc: z.number().min(-1).max(1).optional(),
      fnc: z.number().min(-1).max(1).optional(),
    })
    .optional(),
  famaFrench: z
    .object({
      mkt: z.number().optional(),
      smb: z.number().optional(),
      hml: z.number().optional(),
      rmw: z.number().optional(),
      cma: z.number().optional(),
    })
    .optional(),
});

export const VerificationPerformanceSchema = z.object({
  metrics: MetricsSchema,
  upliftOverBaseline: z.number().optional(),
  profitFactor: z.number().nonnegative().optional(),
});

export const OperationalStabilitySchema = z.object({
  trackingError: z.number().nonnegative(),
  tradingDaysHorizon: z.number().int().nonnegative(),
  isProductionReady: z.boolean(),
});

export const ExecutionAuditSchema = z.object({
  totalPnL: z.number(),
  trackingError: z.number().nonnegative().optional(),
  slippageImpactBps: z.number().nonnegative().optional(),
});

export const StandardOutcomeSchema = z.object({
  strategyId: z.string(),
  strategyName: z.string(),
  timestamp: z.string().datetime(),
  summary: z.string(),
  reasoning: z.string().optional(),
  reasoningScore: z.number().min(0).max(1).optional(),
  strategicReasoning: StrategicReasoningSchema.optional(),
  alphaScreening: AlphaScreeningSchema.optional(),
  modelRegistryStatus: z.string().optional(),
  experimentId: z.string().optional(),
  evidenceSource: z.enum(["QUANT_BACKTEST", "LINGUISTIC_ONLY"]).optional(),
  alpha: AlphaSignificanceSchema.optional(),
  verification: VerificationPerformanceSchema.optional(),
  stability: OperationalStabilitySchema.optional(),
  execution: ExecutionAuditSchema.optional(),
});

export type StandardOutcome = z.infer<typeof StandardOutcomeSchema>;

/**
 * Unified Log Schemas
 */

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
  market: z.object({ vegetablePriceMomentum: z.number() }),
  analysis: z.array(SymbolAnalysisLogSchema),
  decision: z.object({
    strategy: z.string(),
    action: z.enum(["LONG_BASKET", "NO_TRADE"]),
    topSymbol: z.string().length(4),
    reason: z.string(),
    experimentValue: z.enum(["USEFUL", "USELESS"]),
  }),
  signals: z.object({
    macro: z.object({ vegetablePriceMomentum: z.number() }),
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
        grossReturn: z.number(),
        netReturn: z.number(),
        feeBps: z.number(),
        slippageBps: z.number(),
        totalCostBps: z.number(),
        sharpe: z.number().optional(),
      })
      .optional(),
  }),
  workflow: z.object({
    dataReadiness: z.enum(["PASS", "FAIL"]),
    alphaReadiness: z.enum(["PASS", "FAIL"]),
    verdict: z.enum(["USEFUL", "USELESS"]),
  }),
});

export type DailyScenarioLog = z.infer<typeof DailyScenarioLogSchema>;

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
    baselines: z.array(z.object({ name: z.string(), metrics: MetricsSchema })),
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
    "investor.investment-outcome.v1",
  ]),
  generatedAt: z.string().datetime(),
  models: z.array(ModelReferenceLogSchema).optional(),
  report: z.union([
    DailyScenarioLogSchema,
    BenchmarkReportSchema,
    StandardOutcomeSchema,
  ]),
});

export type UnifiedLog = z.infer<typeof UnifiedLogSchema>;

/**
 * Quantitative Verification Reports
 */
export const SymbolTimeSeriesSchema = z.object({
  prices: z.array(z.number()),
  factors: z.array(z.number()),
  positions: z.array(z.number()),
});
export const VerificationMetricsSchema = z.object({
  ic: z.number(),
  sharpe: z.number(),
  maxDD: z.number(),
  totalReturn: z.number(),
  universe: z.array(z.string()),
});
export const VerificationLayoutSchema = z.object({
  mainTitle: z.string(),
  subTitle: z.string(),
  panel1Title: z.string(),
  panel2Title: z.string(),
  panel3Title: z.string(),
  panel4Title: z.string(),
  yAxisReturn: z.string(),
  yAxisSignal: z.string(),
  legendStrategy: z.string(),
  legendBenchmark: z.string(),
});
export const ExecutionCostsSchema = z.object({
  feeBps: z.number().nonnegative(),
  slippageBps: z.number().nonnegative(),
  totalCostBps: z.number().nonnegative(),
});

export const QuantitativeVerificationSchema = z.object({
  schemaVersion: z.string().default("1.1.0"),
  strategyId: z.string(),
  strategyName: z.string(),
  description: z.string(),
  generatedAt: z.string().datetime(),
  audit: z.object({ commitHash: z.string(), environment: z.string() }),
  evaluationWindow: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().positive(),
  }),
  fileName: z.string(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  strategyCum: z.array(z.number()),
  benchmarkCum: z.array(z.number()),
  individualData: z.record(z.string(), SymbolTimeSeriesSchema),
  metrics: VerificationMetricsSchema,
  costs: ExecutionCostsSchema,
  layout: VerificationLayoutSchema,
});

export type QuantitativeVerification = z.infer<
  typeof QuantitativeVerificationSchema
>;
