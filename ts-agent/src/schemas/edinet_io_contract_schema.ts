import { z } from "zod";

export const EdinetIoViolationCategorySchema = z.enum([
  "SCHEMA",
  "REFERENTIAL",
  "TEMPORAL",
  "CARDINALITY",
]);

export const EdinetIoViolationCodeSchema = z.enum([
  "NEGATIVE_CORRECTION_COUNT",
  "MISSING_INTELLIGENCE_ENTRY",
  "CORRECTION_COUNT_MISMATCH",
  "CORRECTION_FLAG_MISMATCH",
  "SIGNAL_WITHOUT_EVENT",
  "EVENT_WITHOUT_SIGNAL",
  "LINEAGE_WITHOUT_DOCUMENT",
  "SIGNAL_WITHOUT_LINEAGE",
  "SIGNAL_WITHOUT_FUTURE_MARKET",
]);

export const EdinetIoViolationSchema = z.object({
  category: EdinetIoViolationCategorySchema,
  code: EdinetIoViolationCodeSchema,
  message: z.string(),
  signalId: z.string().optional(),
  eventId: z.string().optional(),
  symbol: z.string().optional(),
  date: z.string().optional(),
  docId: z.string().optional(),
  actualValue: z.number().nullable().optional(),
  expectedValue: z.number().nullable().optional(),
});

export const EdinetIoReportSchema = z.object({
  status: z.enum(["pass", "fail", "missing_prerequisite"]),
  runAt: z.string(),
  contractVersion: z.string(),
  inputs: z.object({
    knowledgebasePath: z.string(),
    intelligenceMapPath: z.string(),
    quarantineOnly: z.boolean(),
  }),
  totals: z.object({
    signals: z.number().int().nonnegative(),
    eventFeatures: z.number().int().nonnegative(),
    lineageRows: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
  }),
  thresholdByCode: z.record(EdinetIoViolationCodeSchema, z.number().int()),
  violationCountByCode: z.record(EdinetIoViolationCodeSchema, z.number().int()),
  violations: z.array(EdinetIoViolationSchema),
  failureReason: z.string().optional(),
});

export const EdinetIoRepairReportSchema = z.object({
  status: z.enum(["pass", "fail", "missing_prerequisite"]),
  runAt: z.string(),
  contractVersion: z.string(),
  inputs: z.object({
    knowledgebasePath: z.string(),
    intelligenceMapPath: z.string(),
    quarantinePath: z.string(),
    dryRun: z.boolean(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    symbols: z.array(z.string()),
  }),
  totals: z.object({
    scannedMissingSignals: z.number().int().nonnegative(),
    repairedCount: z.number().int().nonnegative(),
    unresolvedCount: z.number().int().nonnegative(),
    missingBefore: z.number().int().nonnegative(),
    missingAfter: z.number().int().nonnegative(),
  }),
  unresolved: z.array(EdinetIoViolationSchema),
  failureReason: z.string().optional(),
});

export type EdinetIoViolation = z.infer<typeof EdinetIoViolationSchema>;
export type EdinetIoViolationCode = z.infer<typeof EdinetIoViolationCodeSchema>;
export type EdinetIoReport = z.infer<typeof EdinetIoReportSchema>;
export type EdinetIoRepairReport = z.infer<typeof EdinetIoRepairReportSchema>;
