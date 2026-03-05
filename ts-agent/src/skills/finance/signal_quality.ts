import { z } from "zod";
import { calculateCorr } from "../../utils/math_utils.ts";
import { skillRegistry } from "../registry.ts";
import type { Skill } from "../types.ts";

/** ローリングIC = 各ウィンドウのピアソン相関 */
export const calculateRollingICSkill: Skill = {
  name: "calculate_rolling_ic",
  description:
    "Calculate rolling Information Coefficient (Pearson correlation in sliding windows).",
  schema: z.object({
    factorSeries: z.array(z.number()).describe("Time series of factor values"),
    returnSeries: z
      .array(z.number())
      .describe("Time series of returns (must match factorSeries length)"),
    window: z.number().default(20).describe("Rolling window size (default 20)"),
  }),
  execute: async ({ factorSeries, returnSeries, window }) => {
    // CDD: Fail fast if validation fails
    if (factorSeries.length !== returnSeries.length) {
      throw new Error(
        `Series length mismatch: factorSeries (${factorSeries.length}) must match returnSeries (${returnSeries.length})`,
      );
    }
    if (factorSeries.length < window) {
      throw new Error(
        `Insufficient data: need at least ${window} points, got ${factorSeries.length}`,
      );
    }

    const rollingICs: number[] = [];

    // Forward-looking rolling window: use past data to predict future
    // For each window position, calculate correlation between factors and returns
    for (let i = 0; i <= factorSeries.length - window; i++) {
      const factorWindow = factorSeries.slice(i, i + window);
      const returnWindow = returnSeries.slice(i, i + window);
      const ic = calculateCorr(factorWindow, returnWindow);
      rollingICs.push(ic);
    }

    return rollingICs;
  },
};

/** ICIR = mean(IC) / std(IC) */
export const calculateICIRSkill: Skill = {
  name: "calculate_icir",
  description:
    "Calculate ICIR (Information Coefficient Information Ratio) = mean(IC) / std(IC).",
  schema: z.object({
    rollingICs: z.array(z.number()).describe("Array of rolling IC values"),
  }),
  execute: async ({ rollingICs }) => {
    if (rollingICs.length === 0) return 0;

    const mean = rollingICs.reduce((a, b) => a + b, 0) / rollingICs.length;
    const variance =
      rollingICs.reduce((a, b) => a + (b - mean) ** 2, 0) / rollingICs.length;
    const std = Math.sqrt(variance);

    if (std === 0) return 0;
    return mean / std;
  },
};

/** ヒット率 = sign 一致割合 */
export const calculateHitRateSkill: Skill = {
  name: "calculate_hit_rate",
  description:
    "Calculate hit rate (fraction of time factor sign matches return sign).",
  schema: z.object({
    factorSeries: z.array(z.number()).describe("Factor values"),
    returnSeries: z.array(z.number()).describe("Return values"),
  }),
  execute: async ({ factorSeries, returnSeries }) => {
    if (
      factorSeries.length === 0 ||
      factorSeries.length !== returnSeries.length
    ) {
      return 0;
    }

    let hits = 0;
    for (let i = 0; i < factorSeries.length; i++) {
      const factorSign = Math.sign(factorSeries[i]!);
      const returnSign = Math.sign(returnSeries[i]!);
      if (factorSign === returnSign && factorSign !== 0) {
        hits++;
      }
    }

    return hits / factorSeries.length;
  },
};

// レジストリに登録
skillRegistry.register(calculateRollingICSkill);
skillRegistry.register(calculateICIRSkill);
skillRegistry.register(calculateHitRateSkill);
