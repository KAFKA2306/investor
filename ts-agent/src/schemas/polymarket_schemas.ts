import { z } from "zod";

export const TokenSchema = z.object({
  token_id: z.string(),
  outcome: z.string(),
  price: z.number().optional(),
});

export const OrderSummarySchema = z.object({
  price: z.string(),
  size: z.string(),
});

export const OrderbookSchema = z.object({
  bids: z.array(OrderSummarySchema),
  asks: z.array(OrderSummarySchema),
});

export const MarketSchema = z.object({
  id: z.string(),
  title: z.string(),
  prices: z.object({
    yes: z.number().min(0).max(1),
    no: z.number().min(0).max(1),
  }),
  spread: z.number().min(0),
  liquidity: z.number().min(0),
  timeToClose: z.number().min(0),
});

export const ScanResultSchema = z.object({
  marketId: z.string(),
  liquidityScore: z.number().min(0).max(1),
  spread: z.number().min(0),
  timeRemaining: z.number().min(0),
  passedFilter: z.boolean(),
});

export const ResearchResultSchema = z.object({
  marketId: z.string(),
  sentimentScore: z.number().min(0).max(1),
  narrative: z.string(),
});

export const PredictionResultSchema = z.object({
  marketId: z.string(),
  pModelXgb: z.number().min(0).max(1),
  pModelLlm: z.number().min(0).max(1),
  pModelConsensus: z.number().min(0).max(1),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export const RiskValidationSchema = z.object({
  marketId: z.string(),
  kellyCriterion: z.number(),
  betSize: z.number().min(0),
  var95Loss: z.number(),
  approved: z.boolean(),
  reasoning: z.string(),
});

export const SignalSchema = z.object({
  marketId: z.string(),
  direction: z.enum(["YES", "NO"]),
  betSize: z.number().min(0),
  edge: z.number(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasoning: z.string(),
});

export const BacktestOutputSchema = z.object({
  timestamp: z.string(),
  window: z.string(),
  signals: z.array(SignalSchema),
  metrics: z.object({
    totalExposure: z.number().min(0),
    maxDrawdown: z.number().min(0).max(1),
    sharpeRatio: z.number(),
    winRate: z.number().min(0).max(1),
  }),
  learningUpdates: z.object({
    lessonsLearned: z.array(z.string()),
    nextScanPriority: z.array(z.string()),
  }),
});

export interface ArbOpportunity {
  marketId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  totalPrice: number;
  potentialProfit: number;
  timestamp: number;
}

export type Market = z.infer<typeof MarketSchema>;
export type ScanResult = z.infer<typeof ScanResultSchema>;
export type ResearchResult = z.infer<typeof ResearchResultSchema>;
export type PredictionResult = z.infer<typeof PredictionResultSchema>;
export type RiskValidation = z.infer<typeof RiskValidationSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type BacktestOutput = z.infer<typeof BacktestOutputSchema>;
export type Orderbook = z.infer<typeof OrderbookSchema>;
