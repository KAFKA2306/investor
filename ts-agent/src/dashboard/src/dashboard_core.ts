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
          tradingDays: z.number().optional(),
        })
        .optional(),
      selectedSymbols: z.array(z.string()).optional(),
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
  schema: z.string().optional(),
  date: z.string().optional(),
  evidence: z
    .object({
      sampleSize: z.number().optional(),
      avgIntradayRange: z.number().optional(),
      avgProfitMargin: z.number().optional(),
      positiveReturnRatio: z.number().optional(),
    })
    .optional(),
  candidates: z
    .array(z.object({ id: z.string(), score: z.number().optional() }))
    .optional(),
});

export type AlphaDiscoveryPayload = z.infer<typeof AlphaDiscoveryPayloadSchema>;

export const ReadinessLogPayloadSchema = z.object({
  schema: z.string().optional(),
  report: z
    .object({
      verdict: z.string().optional(),
      score: z.object({ total: z.number().optional() }).optional(),
      recommendations: z.array(z.string()).optional(),
    })
    .optional(),
});

export type ReadinessLogPayload = z.infer<typeof ReadinessLogPayloadSchema>;

export const UQTLEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  payload_json: z.string(),
});
export type UQTLEvent = z.infer<typeof UQTLEventSchema>;

/**
 * Formatters and Utilities
 */
export const pickNumber = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const canonicalDate = (v: string | undefined): string =>
  v ? v.replace(/[^\d]/g, "").slice(0, 8) : "";
export const formatDate = (v: string): string =>
  v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
export const formatPercent = (v: number, d = 2): string =>
  `${(v * 100).toFixed(d)}%`;

/**
 * Calculators
 */
export const computeConfidence = (
  report: DailyReport,
  readiness: ReadinessLogPayload | null,
): number => {
  const readinessScore = pickNumber(readiness?.report?.score?.total) / 100;
  const edgeScore = clamp01(pickNumber(report.results?.expectedEdge) / 0.25);
  const returnScore = clamp01(
    (pickNumber(report.results?.basketDailyReturn) + 0.03) / 0.06,
  );
  return clamp01(
    edgeScore * 0.35 + returnScore * 0.25 + (readinessScore || 0) * 0.15,
  );
};
