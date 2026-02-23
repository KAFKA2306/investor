import { z } from "zod";

export const Ohlc6Schema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  turnoverValue: z.number(),
});

export const FinanceSnapshotSchema = z.object({
  netSales: z.number(),
  operatingProfit: z.number(),
  profitMargin: z.number(),
});

export const AlphaFactorsSchema = z.object({
  dailyReturn: z.number(),
  intradayRange: z.number(),
  closeStrength: z.number(),
  liquidityPerShare: z.number(),
});

export const MetricsSchema = z.object({
  mae: z.number(),
  rmse: z.number(),
  smape: z.number(),
  directionalAccuracy: z.number(),
  tStat: z.number().optional(),
  pValue: z.number().optional(),
  sharpeRatio: z.number().optional(),
  abstentionRate: z.number().optional(),
  safeAccuracy: z.number().optional(),
  overconfidenceError: z.number().optional(),
  brierScore: z.number().optional(),
  ece: z.number().optional(),
  premiseCoverage: z.number().optional(),
});
