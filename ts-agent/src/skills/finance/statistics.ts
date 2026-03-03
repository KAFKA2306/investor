import { z } from "zod";
import { skillRegistry } from "../registry.ts";
import type { Skill } from "../types.ts";

/**
 * 📉 Sharpe比を計算するスキルだよ！
 */
export const calculateSharpeSkill: Skill = {
  name: "calculate_sharpe",
  description: "Calculate annualised Sharpe Ratio from a series of returns.",
  schema: z.object({
    returns: z.array(z.number()).describe("Daily or periodic returns"),
    riskFreeRate: z.number().default(0).describe("Risk free rate (annualised)"),
    periodsPerYear: z
      .number()
      .default(252)
      .describe("Trading periods per year"),
  }),
  execute: async ({ returns, riskFreeRate, periodsPerYear }) => {
    if (returns.length === 0) return 0;
    const mean =
      returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;

    const periodicRf = riskFreeRate / periodsPerYear;
    const sharpe = ((mean - periodicRf) / stdDev) * Math.sqrt(periodsPerYear);
    return sharpe;
  },
};

/**
 * 🔍 T統計量を計算するスキルだよ！
 */
export const calculateTStatSkill: Skill = {
  name: "calculate_t_stat",
  description: "Calculate T-statistic to test alpha significance.",
  schema: z.object({
    returns: z.array(z.number()),
  }),
  execute: async ({ returns }) => {
    if (returns.length === 0) return 0;
    const mean =
      returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;

    const tStat = mean / (stdDev / Math.sqrt(returns.length));
    return tStat;
  },
};

// レジストリに登録しちゃうよ！🎀
skillRegistry.register(calculateSharpeSkill);
skillRegistry.register(calculateTStatSkill);
