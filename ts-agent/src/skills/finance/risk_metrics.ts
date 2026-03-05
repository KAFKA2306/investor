import { z } from "zod";
import {
  calculateAnnualizedReturn,
  calculateCorr,
  calculateSortinoRatio,
  computeMaxDrawdown,
} from "../../utils/math_utils.ts";
import { skillRegistry } from "../registry.ts";
import type { Skill } from "../types.ts";

/** MaxDrawdown（負の値で返す） */
export const calculateMaxDrawdownSkill: Skill = {
  name: "calculate_max_drawdown",
  description:
    "Calculate maximum drawdown (as negative value) from a series of returns.",
  schema: z.object({
    returns: z
      .array(z.number())
      .describe("Daily or periodic returns (e.g., [0.01, -0.005, 0.02])"),
  }),
  execute: async ({ returns }) => {
    return computeMaxDrawdown(returns);
  },
};

/** Sortino比（年率換算） */
export const calculateSortinoSkill: Skill = {
  name: "calculate_sortino",
  description: "Calculate annualised Sortino Ratio from a series of returns.",
  schema: z.object({
    returns: z.array(z.number()).describe("Daily or periodic returns"),
    riskFreeRate: z.number().default(0).describe("Risk free rate (annualised)"),
    periodsPerYear: z
      .number()
      .default(252)
      .describe("Trading periods per year"),
  }),
  execute: async ({ returns, riskFreeRate, periodsPerYear }) => {
    return calculateSortinoRatio(returns, riskFreeRate, periodsPerYear);
  },
};

/** Calmar比 = 年率リターン / |MaxDrawdown| */
export const calculateCalmarSkill: Skill = {
  name: "calculate_calmar",
  description: "Calculate Calmar Ratio (annualised return / abs max drawdown).",
  schema: z.object({
    returns: z.array(z.number()).describe("Daily or periodic returns"),
    days: z.number().describe("Number of trading days in the period"),
    annualizeFactor: z
      .number()
      .default(252)
      .describe("Trading periods per year"),
  }),
  execute: async ({ returns, days, annualizeFactor }) => {
    if (returns.length === 0) return 0;
    const netReturn = returns.reduce((a, b) => a * (1 + b), 1) - 1;
    const annReturn = calculateAnnualizedReturn(
      netReturn,
      days,
      annualizeFactor,
    );
    const maxDD = Math.abs(computeMaxDrawdown(returns));
    if (maxDD === 0) return 0;
    return annReturn / maxDD;
  },
};

/** Information Coefficient（ピアソン相関） */
export const calculateICSkill: Skill = {
  name: "calculate_ic",
  description:
    "Calculate Information Coefficient (Pearson correlation between factor and forward returns).",
  schema: z.object({
    factorValues: z
      .array(z.number())
      .describe("Factor values (e.g., signals, scores)"),
    forwardReturns: z
      .array(z.number())
      .describe("Forward returns aligned with factor values"),
  }),
  execute: async ({ factorValues, forwardReturns }) => {
    return calculateCorr(factorValues, forwardReturns);
  },
};

// レジストリに登録
skillRegistry.register(calculateMaxDrawdownSkill);
skillRegistry.register(calculateSortinoSkill);
skillRegistry.register(calculateCalmarSkill);
skillRegistry.register(calculateICSkill);
