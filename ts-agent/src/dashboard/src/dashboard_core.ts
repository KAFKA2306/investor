import { z } from "zod";

/**
 * Dashboard Schemas
 */
export const DailyReportSchema = z.object({
  date: z.string().optional(),
  analyzedAt: z.string().optional(),
  workflow: z
    .object({
      dataReadiness: z.string().optional(),
      alphaReadiness: z.string().optional(),
      verdict: z.string().optional(),
    })
    .optional(),
  evidence: z
    .object({
      estat: z
        .object({
          status: z.string().optional(),
          hasStatsData: z.boolean().optional(),
        })
        .optional(),
      jquants: z
        .object({
          status: z.string().optional(),
          listedCount: z.number().optional(),
        })
        .passthrough()
        .optional(),
    })
    .optional(),
  decision: z
    .object({
      strategy: z.string().optional(),
      action: z.string().optional(),
      topSymbol: z.string().optional(),
      reason: z.string().optional(),
      experimentValue: z.string().optional(),
    })
    .optional(),
  execution: z
    .object({
      orders: z
        .array(
          z.object({
            symbol: z.string(),
            side: z.string(),
            quantity: z.number(),
            fillPrice: z.number(),
            notional: z.number(),
            executedAt: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  results: z
    .object({
      expectedEdge: z.number().optional(),
      basketDailyReturn: z.number().optional(),
      status: z.string().optional(),
      mode: z.string().optional(),
      backtest: z
        .object({
          totalCostBps: z.number().optional(),
          netReturn: z.number().optional(),
          grossReturn: z.number().optional(),
          feeBps: z.number().optional(),
          slippageBps: z.number().optional(),
          tradingDays: z.number().optional(),
          sharpe: z.number().optional(),
          maxDrawdown: z.number().optional(),
        })
        .optional(),
      selectedSymbols: z.array(z.string()).optional(),
      paperPnlPerUnit: z.number().optional(),
    })
    .optional(),
  risks: z
    .object({
      kellyFraction: z.number().optional(),
      stopLossPct: z.number().optional(),
      maxPositions: z.number().optional(),
    })
    .optional(),
  analysis: z
    .array(
      z.object({
        symbol: z.string(),
        signal: z.string().optional(),
        alphaScore: z.number().optional(),
        finance: z.object({ profitMargin: z.number().optional() }).optional(),
        factors: z
          .object({
            dailyReturn: z.number().optional(),
            prevDailyReturn: z.number().optional(),
            intradayRange: z.number().optional(),
            closeStrength: z.number().optional(),
            liquidityPerShare: z.number().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type DailyReport = z.infer<typeof DailyReportSchema>;

export const DailyLogEnvelopeSchema = z.object({
  schema: z.string().optional(),
  generatedAt: z.string().optional(),
  report: DailyReportSchema.optional(),
  models: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type DailyLogEnvelope = z.infer<typeof DailyLogEnvelopeSchema>;

export const UnifiedLogPayloadSchema = z.object({
  schema: z.string().optional(),
  generatedAt: z.string().optional(),
  date: z.string().optional(),
  stages: z
    .array(
      z.object({
        name: z.string().optional(),
        status: z.string().optional(),
        metrics: z
          .record(z.string(), z.union([z.number(), z.string()]))
          .optional(),
      }),
    )
    .optional(),
});

export type UnifiedLogPayload = z.infer<typeof UnifiedLogPayloadSchema>;

export const AlphaDiscoveryPayloadSchema = z.object({
  schema: z.literal("investor.alpha-discovery.v3"),
  date: z.string().regex(/^\d{8}$/),
  generatedAt: z.string().datetime(),
  stage: z.literal("DISCOVERY_PRECHECK"),
  scoreType: z.literal("LINGUISTIC_PRECHECK"),
  evidence: z.object({
    sampleSize: z.number().int().positive(),
    selectedCount: z.number().int().nonnegative(),
    selectionRate: z.number().min(0).max(1),
  }),
  quality: z
    .object({
      completeness: z.enum(["COMPLETE", "PARTIAL", "MISSING"]),
      missingFields: z.array(z.string()),
    })
    .default({ completeness: "COMPLETE", missingFields: [] }),
  selected: z.array(z.string()),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        reasoning: z.string(),
        status: z.enum(["SELECTED", "REJECTED"]),
        rejectReason: z.string().optional(),
        recency: z.string().datetime(),
        scores: z.object({
          priority: z.number().min(0).max(1),
          fitness: z.number().min(0).max(1),
          stability: z.number().min(0).max(1),
          adoption: z.number().min(0).max(1),
        }),
        ast: z.unknown().optional(),
        featureSignature: z.string().optional(),
        // [NEW] Drill-down metadata
        docId: z.string().optional(),
        edinetCode: z.string().optional(),
        referenceLinks: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

export type AlphaDiscoveryPayload = z.infer<typeof AlphaDiscoveryPayloadSchema>;

export const IndividualStockDataSchema = z.object({
  symbol: z.string(),
  dates: z.array(z.string()),
  prices: z.array(z.number()),
  factors: z.array(z.number()),
  positions: z.array(z.number()),
});

export type IndividualStockData = z.infer<typeof IndividualStockDataSchema>;

export const StandardVerificationDataSchema = z.object({
  schemaVersion: z.string(),
  strategyId: z.string(),
  strategyName: z.string(),
  description: z.string(),
  generatedAt: z.string().datetime(),
  audit: z.object({
    commitHash: z.string(),
    environment: z.string(),
    runId: z.string().optional(),
    dataFingerprint: z.string().optional(),
  }),
  dates: z.array(z.string()),
  strategyCum: z.array(z.number()),
  benchmarkCum: z.array(z.number()),
  fileName: z.string(),
  metrics: z
    .object({
      ic: z.number().optional(),
      sharpe: z.number().optional(),
      maxDD: z.number().optional(),
      totalReturn: z.number().optional(),
      universe: z.array(z.string()).optional(),
    })
    .optional(),
  costs: z
    .object({
      feeBps: z.number().optional(),
      slippageBps: z.number().optional(),
      totalCostBps: z.number().optional(),
    })
    .optional(),
  individualData: z.record(z.string(), IndividualStockDataSchema).optional(),
});

export type StandardVerificationData = z.infer<
  typeof StandardVerificationDataSchema
>;

const ConnectivityStatusSchema = z.enum(["PASS", "FAIL", "SKIP", "MISSING"]);

export const QualityGatePayloadSchema = z.object({
  verdict: z.enum(["NOT_READY", "CAUTION", "READY"]),
  score: z.number().min(0).max(100),
  components: z.record(z.string(), z.number()),
  derivedFrom: z.array(z.string()),
  generatedAt: z.string().datetime(),
  connectivity: z.object({
    jquants: z.object({
      status: ConnectivityStatusSchema,
      listedCount: z.number().optional(),
    }),
    estat: z.object({
      status: ConnectivityStatusSchema,
      hasStatsData: z.boolean().optional(),
    }),
    kabucom: z.object({
      status: ConnectivityStatusSchema,
    }),
    edinet: z.object({
      status: ConnectivityStatusSchema,
    }),
  }),
});

export type QualityGatePayload = z.infer<typeof QualityGatePayloadSchema>;

export const UQTLEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  payload_json: z.string(),
});
export type UQTLEvent = z.infer<typeof UQTLEventSchema>;

export const CanonicalLogKindSchema = z.enum([
  "daily_decision",
  "benchmark",
  "investment_outcome",
  "alpha_discovery",
  "quality_gate",
  "system_event",
]);

export type CanonicalLogKind = z.infer<typeof CanonicalLogKindSchema>;

export const CanonicalLogEnvelopeV2Schema = z.object({
  schema: z.literal("investor.log-envelope.v2"),
  id: z.string().optional(),
  runId: z.string().optional(),
  kind: CanonicalLogKindSchema,
  asOfDate: z.string().regex(/^\d{8}$/),
  generatedAt: z.string().datetime(),
  producer: z
    .object({
      component: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  payload: z.unknown(),
  derived: z.boolean().optional(),
  lineage: z
    .object({
      sourceSchema: z.string().optional(),
      sourceBucket: z.string().optional(),
      sourceFile: z.string().optional(),
      parentIds: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Formatters and Utilities
 */
export const pickNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number.parseFloat(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const canonicalDate = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const cleaned = v.replace(/[^\d]/g, "");
  if (cleaned.length >= 8) return cleaned.slice(0, 8);
  return "";
};
export const formatDate = (v: string): string =>
  v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
export const formatPercent = (v: number, d = 2): string =>
  `${(v * 100).toFixed(d)}%`;
export const formatBps = (v: number): string => `${v.toFixed(1)} bps`;
export const formatCompact = (v: number): string =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toLocaleString();
export const formatSignedPercent = (v: number, d = 2): string =>
  `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
export const formatNullableNumber = (
  v: number | undefined,
  d = 3,
  suffix = "",
): string => (v === undefined ? "欠損" : `${v.toFixed(d)}${suffix}`);
export const formatPercentNullable = (v: number | undefined, d = 2): string =>
  v === undefined ? "欠損" : formatPercent(v, d);
export const formatSignedPercentNullable = (
  v: number | undefined,
  d = 2,
): string => (v === undefined ? "欠損" : formatSignedPercent(v, d));
export const formatBpsNullable = (v: number | undefined): string =>
  v === undefined ? "欠損" : formatBps(v);
export const chipClass = (verdict: string): string => {
  const normalized = verdict.toUpperCase();
  if (
    normalized.includes("PASS") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("READY")
  )
    return "ready";
  if (
    normalized.includes("CAUTION") ||
    normalized.includes("REJECT") ||
    normalized.includes("WARNING")
  )
    return "caution";
  if (
    normalized.includes("RISK") ||
    normalized.includes("FAIL") ||
    normalized.includes("ERROR") ||
    normalized.includes("MISSING")
  )
    return "risk";
  return "neutral";
};

/**
 * Calculators
 */
export const computeConfidence = (
  report: DailyReport,
  qualityGate: QualityGatePayload | null,
): number | undefined => {
  const qualityRaw = pickNumber(qualityGate?.score);
  const edgeRaw = pickNumber(report.results?.expectedEdge);
  const basketReturnRaw = pickNumber(report.results?.basketDailyReturn);

  if (
    qualityRaw === undefined ||
    edgeRaw === undefined ||
    basketReturnRaw === undefined
  ) {
    return undefined;
  }

  const qualityScore = clamp01(qualityRaw / 100);
  const edgeScore = clamp01(edgeRaw / 0.25);
  const returnScore = clamp01((basketReturnRaw + 0.03) / 0.06);
  return clamp01(edgeScore * 0.4 + returnScore * 0.35 + qualityScore * 0.25);
};

export const computeUqtlVector = (
  report: DailyReport,
  _unified: UnifiedLogPayload | null,
  qualityGate: QualityGatePayload | null,
) => {
  const confidence = computeConfidence(report, qualityGate);
  if (confidence === undefined) return undefined;
  const entropy = 1.0 - confidence;
  return { confidence, entropy, date: report.date };
};

const normalizeMetricKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const stageMetricEntries = (
  payload: UnifiedLogPayload | null | undefined,
): Array<{ stage: string; status: string; key: string; rawValue: unknown }> => {
  if (!payload?.stages) return [];
  const rows: Array<{
    stage: string;
    status: string;
    key: string;
    rawValue: unknown;
  }> = [];
  for (const stage of payload.stages) {
    const metrics = stage.metrics;
    if (!metrics) continue;
    for (const [key, rawValue] of Object.entries(metrics)) {
      rows.push({
        stage: stage.name ?? "unnamed-stage",
        status: stage.status ?? "MISSING",
        key,
        rawValue,
      });
    }
  }
  return rows;
};

export const collectStageMetricRows = (
  payload: UnifiedLogPayload | null | undefined,
): Array<{
  stage: string;
  status: string;
  key: string;
  value: number | undefined;
}> =>
  stageMetricEntries(payload).map((row) => ({
    stage: row.stage,
    status: row.status,
    key: row.key,
    value: pickNumber(row.rawValue),
  }));

export const readStageMetric = (
  payload: UnifiedLogPayload | null | undefined,
  candidateKeys: readonly string[],
): number | undefined => {
  const wanted = new Set(candidateKeys.map(normalizeMetricKey));
  for (const row of stageMetricEntries(payload)) {
    if (!wanted.has(normalizeMetricKey(row.key))) continue;
    const value = pickNumber(row.rawValue);
    if (value !== undefined) return value;
  }
  return undefined;
};

// Chain of Custody Types

export type SourcePath = string;

export type SourceResolver = (root: unknown, path: SourcePath) => unknown;

export const resolveSourcePath: SourceResolver = (root, path) => {
  if (!root || !path) return undefined;
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

export type DerivationId =
  | "recomputeSharpe"
  | "recomputeMaxDD"
  | "recomputeTotalReturn";

export interface DerivationSpec {
  id: DerivationId;
  note: string;
  inputs: SourcePath[];
}

export type ProxySpec =
  | { kind: "none" }
  | {
      kind: "prev_day_return";
      note: string;
      sourcePaths: SourcePath[];
    };

/**
 * Advanced Performance Metrics
 */
export type RollingICPoint = {
  date: string;
  ic: number | null;
  proxy: ProxySpec;
};

export const computeRollingIC = (
  dates: string[],
  factors: number[],
  returns: number[],
  window = 30,
  proxy: ProxySpec = { kind: "none" },
): RollingICPoint[] => {
  const result: RollingICPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    if (i < window - 1) {
      result.push({ date: dates[i], ic: null, proxy });
      continue;
    }

    const windowFactors = factors.slice(i - window + 1, i + 1);
    const windowReturns = returns.slice(i - window + 1, i + 1);

    // Pearson Correlation
    const n = windowFactors.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let j = 0; j < n; j++) {
      sumX += windowFactors[j];
      sumY += windowReturns[j];
      sumXY += windowFactors[j] * windowReturns[j];
      sumX2 += windowFactors[j] * windowFactors[j];
      sumY2 += windowReturns[j] * windowReturns[j];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    const ic = denominator === 0 ? 0 : numerator / denominator;
    result.push({ date: dates[i], ic, proxy });
  }

  return result;
};

export type DrawdownPoint = { date: string; drawdown: number };

export const computeDrawdownSeries = (
  dates: string[],
  cumReturns: number[],
): DrawdownPoint[] => {
  const result: DrawdownPoint[] = [];
  let peak = -Infinity;

  for (let i = 0; i < dates.length; i++) {
    if (cumReturns[i] > peak) {
      peak = cumReturns[i];
    }
    const drawdown = peak === 0 ? 0 : (cumReturns[i] - peak) / peak;
    result.push({ date: dates[i] || `idx_${i}`, drawdown });
  }

  return result;
};

// Recompute Helpers (Chain of Custody)

export const recomputeSharpe = (
  dailyReturns: number[],
  annualFactor = 252,
): number => {
  if (dailyReturns.length === 0) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length;
  return variance === 0
    ? 0
    : (mean / Math.sqrt(variance)) * Math.sqrt(annualFactor);
};

export const recomputeMaxDD = (
  dates: string[],
  cumReturns: number[],
): number => {
  if (cumReturns.length === 0) return 0;
  const ddSeries = computeDrawdownSeries(dates, cumReturns);
  return Math.min(0, ...ddSeries.map((p) => p.drawdown));
};

export const recomputeTotalReturn = (cumReturns: number[]): number => {
  if (cumReturns.length === 0) return 0;
  return (cumReturns.at(-1) ?? 1) - 1;
};
