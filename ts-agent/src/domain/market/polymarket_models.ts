import { z } from "zod";

export const PolymarketTradeSchema = z.object({
  proxyWallet: z.string(),
  side: z.union([z.literal("BUY"), z.literal("SELL")]),
  asset: z.string(),
  conditionId: z.string(),
  size: z.number(),
  price: z.number(),
  timestamp: z.number(),
  title: z.string(),
  slug: z.string(),
  icon: z.string().optional().nullable(),
  eventSlug: z.string(),
  outcome: z.string(),
  outcomeIndex: z.number(),
  name: z.string().optional().nullable(),
  pseudonym: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  profileImage: z.string().optional().nullable(),
  profileImageOptimized: z.string().optional().nullable(),
  transactionHash: z.string(),
});

export type PolymarketTrade = z.infer<typeof PolymarketTradeSchema>;

export const PolymarketPositionSchema = z.object({
  proxyWallet: z.string(),
  asset: z.string(),
  conditionId: z.string(),
  size: z.number(),
  avgPrice: z.number(),
  initialValue: z.number(),
  currentValue: z.number(),
  cashPnl: z.number(),
  percentPnl: z.number(),
  totalBought: z.number(),
  realizedPnl: z.number(),
  percentRealizedPnl: z.number(),
  curPrice: z.number(),
  redeemable: z.boolean(),
  mergeable: z.boolean(),
  title: z.string(),
  slug: z.string(),
  icon: z.string().optional().nullable(),
  eventId: z.string(),
  eventSlug: z.string(),
  outcome: z.string(),
  outcomeIndex: z.number(),
  oppositeOutcome: z.string(),
  oppositeAsset: z.string(),
  endDate: z.string().optional().nullable(),
  negativeRisk: z.boolean().optional().nullable(),
});

export type PolymarketPosition = z.infer<typeof PolymarketPositionSchema>;

export const PolymarketTradeResponseSchema = z.array(PolymarketTradeSchema);
export const PolymarketPositionResponseSchema = z.array(
  PolymarketPositionSchema,
);

export const PolymarketMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  conditionId: z.string(),
  slug: z.string(),
  endDate: z.string().optional().nullable(),
  outcomes: z.string(),
  outcomePrices: z.string(),
  clobTokenIds: z.string(),
  active: z.boolean(),
  closed: z.boolean(),
});

export type PolymarketMarket = z.infer<typeof PolymarketMarketSchema>;

export const PolymarketEventSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  slug: z.string(),
  title: z.string(),
  startDate: z.string().optional().nullable(),
  creationDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  active: z.boolean(),
  closed: z.boolean(),
  archived: z.boolean(),
  markets: z.array(PolymarketMarketSchema),
});

export type PolymarketEvent = z.infer<typeof PolymarketEventSchema>;

export const PolymarketEventResponseSchema = z.array(PolymarketEventSchema);
