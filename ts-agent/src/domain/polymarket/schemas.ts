import { z } from "zod";

export const MarketSchema = z.object({
    conditionId: z.string(),
    question: z.string(),
    outcomes: z.array(z.string()),
    price: z.array(z.number()),
    liquidity: z.number(),
    volume: z.number(),
    spread: z.number(),
    clobTokenIds: z.array(z.string()),
});

export const SignalSchema = z.object({
    conditionId: z.string(),
    pModel: z.number().min(0).max(1),
    pMkt: z.number().min(0).max(1),
    edge: z.number(),
    expectedValue: z.number(),
    timestamp: z.string(),
});

export const PositionSchema = z.object({
    conditionId: z.string(),
    outcomeIndex: z.number(),
    size: z.number(),
    entryPrice: z.number(),
    currentPrice: z.number(),
    pModel: z.number(),
});

export type Market = z.infer<typeof MarketSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Position = z.infer<typeof PositionSchema>;
