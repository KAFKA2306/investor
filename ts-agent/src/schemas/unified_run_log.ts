import { z } from "zod";

const YYYYMMDD = z.string().regex(/^\d{8}$/);

export const UnifiedStageLogSchema = z.object({
  stageId: z.string().min(1),
  category: z.enum(["scenario", "experiment", "pipeline", "verification"]),
  name: z.string().min(1),
  status: z.enum(["PASS", "FAIL"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  metrics: z.record(z.string(), z.number()),
  detail: z.unknown().optional(),
  error: z.string().optional(),
});

export const UnifiedRunLogSchema = z.object({
  schema: z.literal("investor.unified-log"),
  generatedAt: z.string().datetime(),
  date: YYYYMMDD,
  runId: z.string().min(1),
  stages: z.array(UnifiedStageLogSchema).min(1),
});

export type UnifiedStageLog = z.infer<typeof UnifiedStageLogSchema>;
export type UnifiedRunLog = z.infer<typeof UnifiedRunLogSchema>;
