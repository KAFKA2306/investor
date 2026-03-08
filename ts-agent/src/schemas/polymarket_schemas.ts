import { z } from "zod";

export const TokenSchema = z.object({
  token_id: z.string(),
  outcome: z.string(),
  price: z.number().optional(),
});

export const MarketSchema = z.object({
  condition_id: z.string(),
  question: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
  tokens: z.array(TokenSchema),
});

export const OrderSummarySchema = z.object({
  price: z.string(),
  size: z.string(),
});

export const OrderbookSchema = z.object({
  bids: z.array(OrderSummarySchema),
  asks: z.array(OrderSummarySchema),
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

export type Orderbook = z.infer<typeof OrderbookSchema>;
export type Market = z.infer<typeof MarketSchema>;
