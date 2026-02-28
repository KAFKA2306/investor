import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { UnifiedLogSchema } from "../../schemas/log.ts";

const YYYMMDD = z.string().regex(/^\d{8}$/);

export const PerformanceLedgerRowSchema = z.object({
  date: YYYMMDD,
  strategyId: z.string(),
  grossReturn: z.number(),
  netReturn: z.number(),
  benchmarkReturn: z.number().optional(),
  feeBps: z.number().min(0),
  slippageBps: z.number().min(0),
  totalCostBps: z.number().min(0),
  grossExposure: z.number().min(0),
  drawdown: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PerformanceLedgerRow = z.infer<typeof PerformanceLedgerRowSchema>;

export const PerformanceLedgerSchema = z.object({
  schema: z.literal("investor.performance-ledger.v1"),
  generatedAt: z.string().datetime(),
  rows: z.array(PerformanceLedgerRowSchema),
});

export type PerformanceLedger = z.infer<typeof PerformanceLedgerSchema>;

export function loadPerformanceLedgerRows(
  logsDir: string,
): PerformanceLedgerRow[] {
  if (!fs.existsSync(logsDir)) return [];
  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".json"));
  const rows: PerformanceLedgerRow[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(logsDir, file), "utf8");
      const log = UnifiedLogSchema.parse(JSON.parse(content));
      // biome-ignore lint/suspicious/noExplicitAny: complex union type cast
      const report = log.report as any;
      if (report.scenarioId && report.results) {
        const r = report.results;
        if (r.backtest) {
          rows.push({
            date: report.date,
            strategyId: report.scenarioId,
            grossReturn: r.backtest.grossReturn,
            netReturn: r.backtest.netReturn,
            feeBps: r.backtest.feeBps,
            slippageBps: r.backtest.slippageBps,
            totalCostBps: r.backtest.totalCostBps,
            grossExposure: 1.0, // Default to 1.0 for now
            metadata: { file },
          });
        }
      }
    } catch (_e) {
      // Skip invalid logs
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
