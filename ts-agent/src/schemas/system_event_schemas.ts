import { z } from "zod";

/**
 * UQTL (Unified Quantum Task Ledger) Event Schemas
 */
export const EventTypeSchema = z.enum([
  "MARKET_DATA_FETCHED",
  "ALPHA_GENERATED",
  "ALPHA_EVALUATED",
  "BACKTEST_COMPLETED",
  "STRATEGY_DECIDED",
  "OPERATOR_MUTATED",
  "SYSTEM_LOG",
  "ERROR_OCCURRED",
  "RUN_STARTED",
  "RUN_FINISHED",
  "RUN_FAILED",
  "AGENT_STARTED",
  "AGENT_COMPLETED",
  "AGENT_FAILED",
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

/**
 * Canonical Log Envelope (v2)
 *
 * The source of truth is immutable evidence logs.
 * "Readiness" is treated as a derived quality gate, not a first-class raw log.
 */
export const CanonicalLogKindSchema = z.enum([
  "daily_decision",
  "benchmark",
  "investment_outcome",
  "alpha_discovery",
  "quality_gate",
  "system_event",
]);

export type CanonicalLogKind = z.infer<typeof CanonicalLogKindSchema>;

export const CanonicalLogEnvelopeSchema = z.object({
  schema: z.literal("investor.log-envelope.v2"),
  id: z.string(),
  runId: z.string().optional(),
  kind: CanonicalLogKindSchema,
  asOfDate: z.string().regex(/^\d{8}$/),
  generatedAt: z.string().datetime(),
  producer: z.object({
    component: z.string(),
    version: z.string().optional(),
  }),
  payload: z.unknown(),
  derived: z.boolean().default(false),
  lineage: z
    .object({
      sourceSchema: z.string().optional(),
      sourceBucket: z.string().optional(),
      sourceFile: z.string().optional(),
      parentIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CanonicalLogEnvelope = z.infer<typeof CanonicalLogEnvelopeSchema>;

export const QualityGateSchema = z.object({
  verdict: z.enum(["NOT_READY", "CAUTION", "READY"]),
  score: z.number().min(0).max(100),
  components: z.record(z.string(), z.number().min(0).max(100)),
  derivedFrom: z.array(z.string()),
  generatedAt: z.string().datetime(),
});

export type QualityGate = z.infer<typeof QualityGateSchema>;
