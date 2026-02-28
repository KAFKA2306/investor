import { z } from "zod";

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
