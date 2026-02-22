import { z } from "zod";

export const KabuOrderSchema = z.object({
  symbol: z.string().length(4),
  side: z.enum(["1", "2"]), // 1: Sell, 2: Buy
  orderType: z.number().int().min(1).max(2), // 1: Market, 2: Limit
  qty: z.number().int().positive(),
  price: z.number().positive().optional(),
  expireDay: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  delivDay: z.number().int().optional(),
});

export type KabuOrder = z.infer<typeof KabuOrderSchema>;

export const KabuResponseSchema = z.object({
  ResultCode: z.number().int(),
  OrderId: z.string().optional(),
});

export type KabuResponse = z.infer<typeof KabuResponseSchema>;
