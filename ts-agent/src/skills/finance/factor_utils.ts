import { z } from "zod";
import { gaussRank, zScore } from "../../utils/math_utils.ts";
import { skillRegistry } from "../registry.ts";
import type { Skill } from "../types.ts";

/** Winsorize: 上下パーセンタイルでクリップ */
export const winsorizeFactorSkill: Skill = {
  name: "winsorize_factor",
  description: "Winsorize factor values by clipping at specified percentiles.",
  schema: z.object({
    values: z.array(z.number()).describe("Factor values to winsorize"),
    lowerPct: z
      .number()
      .default(0.01)
      .describe("Lower percentile (default 0.01 = 1st percentile)"),
    upperPct: z
      .number()
      .default(0.99)
      .describe("Upper percentile (default 0.99 = 99th percentile)"),
  }),
  execute: async ({ values, lowerPct, upperPct }) => {
    if (values.length === 0) return [];
    // Use Array.from instead of spread to avoid unnecessary duplication when sorting
    const sorted = Array.from(values).sort((a, b) => a - b);
    const lowerIdx = Math.floor(values.length * lowerPct);
    const upperIdx = Math.ceil(values.length * upperPct);
    const lowerBound = sorted[lowerIdx] ?? values[0]!;
    const upperBound = sorted[upperIdx] ?? values[values.length - 1]!;

    return values.map((v) => Math.max(lowerBound, Math.min(v, upperBound)));
  },
};

/** Z-score正規化 */
export const normalizeFactorSkill: Skill = {
  name: "normalize_factor",
  description: "Normalize factor values using Z-score standardization.",
  schema: z.object({
    values: z.array(z.number()).describe("Factor values to normalize"),
  }),
  execute: async ({ values }) => {
    return zScore(values);
  },
};

/** ガウスランク変換 */
export const gaussRankFactorSkill: Skill = {
  name: "gauss_rank_factor",
  description:
    "Apply Gauss rank transformation to factor values (rank → inverse normal CDF).",
  schema: z.object({
    values: z.array(z.number()).describe("Factor values to rank transform"),
  }),
  execute: async ({ values }) => {
    return gaussRank(values);
  },
};

// レジストリに登録
skillRegistry.register(winsorizeFactorSkill);
skillRegistry.register(normalizeFactorSkill);
skillRegistry.register(gaussRankFactorSkill);
