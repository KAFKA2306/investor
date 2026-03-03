import { z } from "zod";

/**
 * ✨ システムイベントと金融ドメインの最強スキーマ集だよっ！ ✨
 */

// --- EDINET 関連 ---
export const EdinetDocumentSchema = z.object({
  docID: z.string(),
  secCode: z.string().nullable(),
  edinetCode: z.string().nullable(),
  filerName: z.string().nullable(),
  docDescription: z.string().nullable(),
  docTypeCode: z.string().nullable(),
  submitDateTime: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  parentDocID: z.string().nullable(),
  opeDateTime: z.string().nullable(),
  withdrawalStatus: z.string().nullable(),
  currentReportReason: z.string().nullable(),
});

export type EdinetDocument = z.infer<typeof EdinetDocumentSchema>;

export const EdinetDocumentListResponseSchema = z.object({
  metadata: z.object({
    title: z.string(),
    parameter: z.object({
      date: z.string(),
      type: z.string(),
    }),
    resultset: z.object({
      count: z.number().int(),
    }),
    processDateTime: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  results: z.array(EdinetDocumentSchema).default([]),
});

export type EdinetDocumentListResponse = z.infer<
  typeof EdinetDocumentListResponseSchema
>;

export type EdinetDocumentType = 1 | 2 | 3 | 4 | 5;

export const EdinetDocumentTypeLabel: Record<EdinetDocumentType, string> = {
  1: "XBRL",
  2: "PDF",
  3: "代替書面・添付書類",
  4: "英文XBRL",
  5: "CSV",
};

// --- 金融ドメイン固有の DSL / 構造 ---

export interface FactorAST {
  type: "variable" | "constant" | "operator";
  name?: string;
  value?: number;
  left?: FactorAST;
  right?: FactorAST;
}

export interface FactorGenerationOptions {
  count?: number;
}

// --- システムイベント関連 ---

export const EventTypeSchema = z.enum([
  "ALPHA_GENERATED",
  "STRATEGY_DECIDED",
  "SYSTEM_LOG",
  "RUN_STARTED",
  "RUN_FINISHED",
  "RUN_FAILED",
  "AGENT_STARTED",
  "AGENT_COMPLETED",
  "AGENT_FAILED",
  "PIPELINE_STARTED",
  "PIPELINE_COMPLETED",
  "DATASET_PREPARED",
  "STRATEGY_EXECUTED",
  "STRATEGY_REJECTED",
  "ORDER_PLAN_SAVED",
  "MODEL_CONFIG_SAVED",
  "AUDIT_RECORD_SAVED",
  "STATE_UPDATED",
  "OUTCOME_GENERATED",
  "AUDIT_COMPLETED",
  "DOMAIN_PIVOTED",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const BaseEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: EventTypeSchema,
  agentId: z.string().optional(),
  operatorId: z.string().optional(),
  experimentId: z.string().optional(),
  parentEventId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UQTLEvent = z.infer<typeof BaseEventSchema>;

// --- プロバイダー / 外部データ関連 ---
export const YahooChartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          timestamp: z.array(z.number()),
          indicators: z.object({
            quote: z.array(
              z.object({
                open: z.array(z.number().nullable()),
                high: z.array(z.number().nullable()),
                low: z.array(z.number().nullable()),
                close: z.array(z.number().nullable()),
                volume: z.array(z.number().nullable()),
              }),
            ),
          }),
        }),
      )
      .optional(),
  }),
});

export type YahooChartPayload = z.infer<typeof YahooChartSchema>;

export interface MarketBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum Verdict {
  VALID = "VALID",
  INVALID = "INVALID",
  UNCERTAIN = "UNCERTAIN",
}

export enum VerificationVerdict {
  PASS = "PASS",
  FAIL = "FAIL",
  REJECTED_GENERAL = "REJECTED_GENERAL",
  REJECTED_DATA = "REJECTED_DATA",
  REJECTED_MODEL = "REJECTED_MODEL",
  ADOPTED = "ADOPTED",
}

export enum CanonicalLogKind {
  DATA_ENGINEER = "data_engineer",
  QUANT_RESEARCHER = "quant_researcher",
  ADAPTATION_STRATEGY = "adaptation_strategy",
  VERIFICATION_RECORD = "verification_record",
  ALPHA_DISCOVERY = "alpha_discovery",
  DAILY_DECISION = "daily_decision",
}

export const CanonicalLogEnvelopeSchema = z.object({
  schema: z.string(),
  id: z.string(),
  kind: z.union([z.nativeEnum(CanonicalLogKind), z.string()]),
  asOfDate: z.string().optional(),
  generatedAt: z.string().datetime(),
  producerComponent: z.string().optional(),
  producerVersion: z.string().optional(),
  payload: z.unknown(),
});

export enum AlphaStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DECAYED = "DECAYED",
}

export enum EvidenceSource {
  QUANT_BACKTEST = "QUANT_BACKTEST",
  LINGUISTIC_ONLY = "LINGUISTIC_ONLY",
}

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

export const StrategicReasoningSchema = z.object({
  rationale: z.string(),
  logicChecks: z.array(
    z.object({
      claim: z.string(),
      verdict: z.nativeEnum(Verdict),
      evidence: z.string().optional(),
    }),
  ),
  contextAlignment: z.number().min(0).max(1),
  marketRegime: z.string(),
});

export const AlphaScreeningSchema = z.object({
  status: z.nativeEnum(AlphaStatus),
  reason: z.string(),
  lastUpdated: z.string().datetime(),
  score: z.number().min(0).max(1),
});

export type StrategicReasoning = z.infer<typeof StrategicReasoningSchema>;
export type AlphaScreening = z.infer<typeof AlphaScreeningSchema>;

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
  evidenceSource: z.nativeEnum(EvidenceSource).optional(),
  alpha: AlphaSignificanceSchema.optional(),
  verification: VerificationPerformanceSchema.optional(),
  stability: OperationalStabilitySchema.optional(),
  execution: ExecutionAuditSchema.optional(),
});

export type StandardOutcome = z.infer<typeof StandardOutcomeSchema>;

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
    "investor.alpha-discovery.v3",
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
  winRate: z.number().optional(),
  volatility: z.number().optional(),
  cagr: z.number().optional(),
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
  schemaVersion: z.string().default("1.1.8"),
  strategyId: z.string(),
  strategyName: z.string(),
  description: z.string(),
  generatedAt: z.string().datetime(),
  audit: z.object({
    commitHash: z.string().length(40),
    environment: z.string(),
    schemaVersion: z.literal("1.1.8"),
  }),
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

export const FinancialScoresSchema = z.object({
  fitnessScore: z.number().min(0).max(1),
  stabilityScore: z.number().min(0).max(1),
  adoptionScore: z.number().min(0).max(1),
});

export const EvaluationCriteriaSchema = z.object({
  alpha: z.object({
    minTStat: z.number().default(2.0),
    maxPValue: z.number().default(0.05),
    minIC: z.number().default(0.04),
  }),
  performance: z.object({
    minSharpe: z.number().default(1.8),
    maxDrawdown: z.number().default(0.1),
  }),
  stability: z.object({
    maxTrackingError: z.number().default(0.02),
  }),
  data: z.object({
    minQualityScore: z.number().default(0.82),
    minCoverageRate: z.number().default(0.8),
    maxMissingRate: z.number().default(0.08),
  }),
});

export type EvaluationCriteria = z.infer<typeof EvaluationCriteriaSchema>;

export const DEFAULT_EVALUATION_CRITERIA: EvaluationCriteria =
  EvaluationCriteriaSchema.parse({
    alpha: {},
    performance: {},
    stability: {},
    data: {},
  });
export type FinancialScores = z.infer<typeof FinancialScoresSchema>;

export const CycleSummarySchema = z.object({
  cycleNumber: z.number().int().positive(),
  runId: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  candidatesGenerated: z.number().int().nonnegative(),
  candidatesAdopted: z.number().int().nonnegative(),
  avgSharpe: z.number(),
  avgIC: z.number(),
  avgFitness: z.number(),
  adoptedIds: z.array(z.string()),
  playbookBulletCount: z.number().int().nonnegative(),
});
export type CycleSummary = z.infer<typeof CycleSummarySchema>;
