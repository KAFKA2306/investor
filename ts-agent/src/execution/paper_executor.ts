import { z } from "zod";
import type { PaperExecutionInput } from "../contracts/trading.ts";

export const PaperOrderSchema = z.object({
  symbol: z.string().length(4),
  side: z.literal("BUY"),
  quantity: z.number().int().positive(),
  fillPrice: z.number().nonnegative(),
  notional: z.number().nonnegative(),
  executedAt: z.string().datetime(),
});

export const PaperExecutionSchema = z.object({
  mode: z.literal("PAPER"),
  status: z.enum(["EXECUTED", "SKIPPED"]),
  orderCount: z.number().int().nonnegative(),
  orders: z.array(PaperOrderSchema),
  summary: z.object({
    grossExposure: z.number().nonnegative(),
  }),
});

export type PaperExecution = z.infer<typeof PaperExecutionSchema>;

const DEFAULT_LOT = 100;

export function executePaperOrders(
  report: PaperExecutionInput,
  nowIso: string,
): PaperExecution {
  const action = report.decision.action;
  if (action !== "LONG_BASKET" || report.results.selectedSymbols.length === 0) {
    return PaperExecutionSchema.parse({
      mode: "PAPER",
      status: "SKIPPED",
      orderCount: 0,
      orders: [],
      summary: { grossExposure: 0 },
    });
  }

  const rows = new Map(report.analysis.map((row) => [row.symbol, row]));
  const orders = report.results.selectedSymbols.map((symbol) => {
    const row = rows.get(symbol);
    const fillPrice = row?.ohlc6.close ?? 0;
    const quantity = DEFAULT_LOT;
    return {
      symbol,
      side: "BUY" as const,
      quantity,
      fillPrice,
      notional: fillPrice * quantity,
      executedAt: nowIso,
    };
  });
  const grossExposure = orders.reduce((acc, order) => acc + order.notional, 0);
  return PaperExecutionSchema.parse({
    mode: "PAPER",
    status: orders.length > 0 ? "EXECUTED" : "SKIPPED",
    orderCount: orders.length,
    orders,
    summary: { grossExposure },
  });
}
