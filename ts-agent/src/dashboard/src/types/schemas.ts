import { z } from "zod";

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
        finance: z
          .object({
            profitMargin: z.number().optional(),
          })
          .optional(),
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
  evidenceSource: z.enum(["QUANT_BACKTEST", "LINGUISTIC_ONLY"]).optional(),
  execution: z
    .object({
      status: z.string().optional(),
      mode: z.string().optional(),
      orderCount: z.number().optional(),
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
});

export type DailyReport = z.infer<typeof DailyReportSchema>;

export const DailyLogEnvelopeSchema = z.object({
  schema: z.string().optional(),
  generatedAt: z.string().optional(),
  report: DailyReportSchema.optional(),
  models: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type DailyLogEnvelope = z.infer<typeof DailyLogEnvelopeSchema>;

export const BenchmarkLogPayloadSchema = z.object({
  schema: z.string().optional(),
  generatedAt: z.string().optional(),
  report: z
    .object({
      type: z.string().optional(),
      benchmarkId: z.string().optional(),
      date: z.string().optional(),
      analyst: z
        .object({
          insights: z.string().optional(),
          baselines: z
            .array(
              z.object({
                name: z.string(),
                metrics: z.object({
                  mae: z.number().optional(),
                  rmse: z.number().optional(),
                  smape: z.number().optional(),
                  directionalAccuracy: z.number().optional(),
                }),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export type BenchmarkLogPayload = z.infer<typeof BenchmarkLogPayloadSchema>;

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
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  selected: z.array(z.string()).optional(),
  evidence: z
    .object({
      sampleSize: z.number().optional(),
      avgIntradayRange: z.number().optional(),
      avgProfitMargin: z.number().optional(),
      positiveReturnRatio: z.number().optional(),
    })
    .optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        reasoning: z.string().optional(),
        score: z.number().optional(),
        icProxy: z.number().optional(),
        orthogonality: z.number().optional(),
        correlationToBaseline: z.number().optional(),
      }),
    )
    .optional(),
});

export type AlphaDiscoveryPayload = z.infer<typeof AlphaDiscoveryPayloadSchema>;

export const ReadinessLogPayloadSchema = z.object({
  schema: z.string().optional(),
  report: z
    .object({
      verdict: z.string().optional(),
      score: z
        .object({
          total: z.number().optional(),
        })
        .optional(),
      recommendations: z.array(z.string()).optional(),
      sampleSize: z.number().optional(),
    })
    .optional(),
});

export type ReadinessLogPayload = z.infer<typeof ReadinessLogPayloadSchema>;

export const UQTLEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  agent_id: z.string().optional(),
  experiment_id: z.string().optional(),
  payload_json: z.string(),
  metadata_json: z.string().optional(),
});

export type UQTLEvent = z.infer<typeof UQTLEventSchema>;
