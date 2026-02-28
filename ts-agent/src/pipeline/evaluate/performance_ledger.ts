import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type PerformanceLedgerRow,
  PerformanceLedgerRowSchema,
} from "../../backtest/performance_ledger.ts";
import { UnifiedLogSchema } from "../../schemas/log.ts";

const DEFAULT_STRATEGY_ID = "VEGETABLE_STRATEGY";

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toDailyLedgerRow(
  raw: unknown,
  fallbackDate: string,
): PerformanceLedgerRow | null {
  const parsedLog = UnifiedLogSchema.safeParse(raw);
  if (!parsedLog.success) return null;

  const log = parsedLog.data;
  if (log.schema !== "investor.daily-log.v1") return null;
  if (typeof log.report !== "object" || log.report === null) return null;
  if (!("results" in log.report) || !("execution" in log.report)) return null;

  const report = log.report;
  const backtest = report.results.backtest;
  const grossReturn = safeNumber(
    backtest?.grossReturn,
    safeNumber(report.results.basketDailyReturn, 0),
  );
  const netReturn = safeNumber(
    backtest?.netReturn,
    safeNumber(report.results.paperPnlPerUnit, 0),
  );
  const feeBps = safeNumber(backtest?.feeBps, 0);
  const slippageBps = safeNumber(backtest?.slippageBps, 0);
  const totalCostBps = safeNumber(backtest?.totalCostBps, feeBps + slippageBps);
  const grossExposure = safeNumber(report.execution.summary.grossExposure, 0);

  const rowRaw = {
    date: report.date || fallbackDate,
    strategyId: report.scenarioId || DEFAULT_STRATEGY_ID,
    grossReturn,
    netReturn,
    feeBps,
    slippageBps,
    totalCostBps,
    grossExposure,
    metadata: {
      status: report.results.status,
      action: report.decision.action,
      workflowVerdict: report.workflow.verdict,
    },
  };

  const parsedRow = PerformanceLedgerRowSchema.safeParse(rowRaw);
  return parsedRow.success ? parsedRow.data : null;
}

export function loadPerformanceLedgerRows(
  logsDir: string,
): PerformanceLedgerRow[] {
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}(?:_[\w-]+)?\.json$/.test(f))
    .sort();

  const rows: PerformanceLedgerRow[] = [];
  for (const file of files) {
    const raw = readFileSync(join(logsDir, file), "utf8");
    let logRaw: unknown = null;
    try {
      logRaw = JSON.parse(raw);
    } catch {
      continue;
    }

    const fallbackDate = file.slice(0, 8);
    const row = toDailyLedgerRow(logRaw, fallbackDate);
    if (row) rows.push(row);
  }

  return rows;
}
