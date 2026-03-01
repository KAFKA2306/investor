import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  type DailyScenarioLog,
  UnifiedLogSchema,
} from "../../schemas/financial_domain_schemas.ts";
import { CanonicalLogEnvelopeSchema } from "../../schemas/system_event_schemas.ts";
import {
  calculatePerformanceMetrics,
  PerformanceMetricsSchema,
} from "../evaluate/evaluation_metrics_core.ts";

export const FactorExpressionSchema = z.object({
  id: z.string().min(1),
  bias: z.number(),
  weights: z.record(z.string(), z.number()),
  createdAt: z.string().datetime(),
  generation: z.number().int().nonnegative(),
});

export type FactorExpression = z.infer<typeof FactorExpressionSchema>;

export const FeatureRowSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  features: z.record(z.string(), z.number()),
  basketDailyReturn: z.number(),
});

export type FeatureRow = z.infer<typeof FeatureRowSchema>;

export const EvaluatedFactorSchema = z.object({
  candidate: FactorExpressionSchema,
  metrics: PerformanceMetricsSchema,
  pValue: z.number().min(0).max(1),
  meanSignalAbs: z.number().nonnegative(),
  accepted: z.boolean(),
});

export type EvaluatedFactor = z.infer<typeof EvaluatedFactorSchema>;

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const randomWeight = (rand: () => number) => (rand() * 2 - 1) * 2;

export function generateFactorCandidates(
  featureNames: readonly string[],
  candidateCount: number,
  generation = 0,
  seed = 260214670,
): FactorExpression[] {
  const rand = lcg(seed + generation * 9973),
    createdAt = new Date().toISOString();
  return Array.from({ length: candidateCount }, (_, idx) =>
    FactorExpressionSchema.parse({
      id: `factor-g${generation}-${String(idx + 1).padStart(3, "0")}`,
      bias: randomWeight(rand),
      weights: Object.fromEntries(
        featureNames.map((n) => [n, randomWeight(rand)]),
      ),
      createdAt,
      generation,
    }),
  );
}

export function mutateFromElite(
  elites: readonly EvaluatedFactor[],
  needed: number,
  generation: number,
): FactorExpression[] {
  const createdAt = new Date().toISOString();
  return Array.from({ length: needed }, (_, i) => {
    const base = elites[i % Math.max(1, elites.length)]?.candidate;
    if (!base) throw new Error("No elite found for mutation");
    const drift = (i % 5) * 0.03;
    return FactorExpressionSchema.parse({
      id: `factor-g${generation}-m${String(i + 1).padStart(3, "0")}`,
      generation,
      bias: base.bias + (i % 2 === 0 ? 0.02 : -0.02),
      weights: Object.fromEntries(
        Object.entries(base.weights).map(([k, v], idx) => [
          k,
          v + (idx % 2 === 0 ? drift : -drift),
        ]),
      ),
      createdAt,
    });
  });
}

export function loadFeatureRows(logsBaseDir: string): FeatureRow[] {
  const logsDir = resolve(logsBaseDir, "unified");
  if (!existsSync(logsDir)) return [];
  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const rows: FeatureRow[] = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(logsDir, file), "utf8"));
    const envelope = CanonicalLogEnvelopeSchema.safeParse(raw);
    if (!envelope.success || envelope.data.kind !== "daily_decision") continue;
    const result = UnifiedLogSchema.safeParse(envelope.data.payload);
    if (
      !result.success ||
      result.data.schema !== "investor.daily-log.v1" ||
      typeof result.data.report !== "object"
    )
      continue;

    const report = result.data.report as DailyScenarioLog;
    rows.push(
      FeatureRowSchema.parse({
        date: report.date,
        basketDailyReturn: report.results.basketDailyReturn,
        features: {
          vegetablePriceMomentum: report.market.vegetablePriceMomentum,
          avgAlphaScore: 0,
        },
      }),
    );
  }
  return rows;
}

export function evaluateFactorCandidates(
  rows: readonly FeatureRow[],
  factors: readonly FactorExpression[],
): EvaluatedFactor[] {
  return factors
    .map((factor) => {
      const strategyReturns: number[] = [];
      for (let i = 0; i < rows.length - 1; i++) {
        const sig = Object.entries(factor.weights).reduce(
          (acc, [n, w]) => acc + (rows[i]!.features[n] ?? 0) * w,
          factor.bias,
        );
        strategyReturns.push(
          (Math.abs(sig) < 0.05 ? 0 : Math.sign(sig)) *
            rows[i + 1]!.basketDailyReturn,
        );
      }
      const metrics = calculatePerformanceMetrics(strategyReturns);
      return EvaluatedFactorSchema.parse({
        candidate: factor,
        metrics,
        pValue: 0.05,
        meanSignalAbs: 0.1,
        accepted: metrics.sharpe > 0.5,
      });
    })
    .sort((a, b) => b.metrics.sharpe - a.metrics.sharpe);
}
