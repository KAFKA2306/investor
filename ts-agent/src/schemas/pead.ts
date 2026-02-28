import { z } from "zod";

export const CalendarEntrySchema = z.object({
  code: z.string().length(4),
});

export const FinancialStatementSchema = z.object({
  LocalCode: z.string().length(4),
  NetIncome: z.number(),
  NetSales: z.number(),
});

export const DailyQuoteSchema = z.object({
  Date: z.string(),
  Code: z.string(),
  Open: z.number().nullable(),
  High: z.number().nullable(),
  Low: z.number().nullable(),
  Close: z.number().nullable(),
  Volume: z.number().nullable(),
  AdjustmentClose: z.number().nullable(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
export type DailyQuote = z.infer<typeof DailyQuoteSchema>;
