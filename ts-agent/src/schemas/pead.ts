import { z } from "zod";

export const CalendarEntrySchema = z.object({
  code: z.string().length(4),
});

export const FinancialStatementSchema = z.object({
  LocalCode: z.string().length(4),
  NetIncome: z.number(),
  NetSales: z.number(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
