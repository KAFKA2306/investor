import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  evaluateFactorCandidates,
  FactorExpressionSchema,
  generateFactorCandidates,
  loadFeatureRows,
  mutateFromElite,
} from "./factor_evolution_core.ts";

const FactorMiningReportSchema = z.object({
  generatedAt: z.string().datetime(),
  source: z.object({
    logsDir: z.string(),
    rows: z.number().int().nonnegative(),
  }),
  config: z.object({
    generations: z.number().int().positive(),
    candidatesPerGeneration: z.number().int().positive(),
    eliteCount: z.number().int().positive(),
  }),
  acceptedCount: z.number().int().nonnegative(),
  top: z.array(
    z.object({
      factor: FactorExpressionSchema,
      sharpe: z.number(),
      cumulativeReturn: z.number(),
      maxDrawdown: z.number(),
      pValue: z.number(),
      accepted: z.boolean(),
    }),
  ),
});

const FactorRegistrySchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  factors: z.array(
    z.object({
      id: z.string(),
      generation: z.number().int().nonnegative(),
      bias: z.number(),
      weights: z.record(z.string(), z.number()),
      metrics: z.object({
        sharpe: z.number(),
        cumulativeReturn: z.number(),
        maxDrawdown: z.number(),
        pValue: z.number(),
        accepted: z.boolean(),
      }),
    }),
  ),
});

export function runFactorMining(logsBaseDir: string, registryDir: string) {
  const rows = loadFeatureRows(logsBaseDir);
  if (rows.length < 2)
    return FactorMiningReportSchema.parse({
      generatedAt: new Date().toISOString(),
      source: { logsDir: resolve(logsBaseDir, "daily"), rows: rows.length },
      config: { generations: 0, candidatesPerGeneration: 0, eliteCount: 0 },
      acceptedCount: 0,
      top: [],
    });
  const featureNames = Object.keys(rows[0]?.features ?? {}),
    config = {
      generations: 3,
      candidatesPerGeneration: 24,
      eliteCount: 6,
    } as const;
  let pool = generateFactorCandidates(
      featureNames,
      config.candidatesPerGeneration,
      0,
    ),
    scored = evaluateFactorCandidates(rows, pool);
  for (let generation = 1; generation < config.generations; generation++) {
    const elites = scored.slice(0, config.eliteCount);
    const mutated = mutateFromElite(
      elites,
      config.candidatesPerGeneration - elites.length,
      generation,
    );
    pool = [...elites.map((e) => e.candidate), ...mutated];
    scored = evaluateFactorCandidates(rows, pool);
  }
  const top = scored.slice(0, 10),
    acceptedCount = top.filter((t) => t.accepted).length;
  const registry = FactorRegistrySchema.parse({
    version: "1.0.0",
    updatedAt: new Date().toISOString().slice(0, 10),
    factors: top.map((e) => ({
      id: e.candidate.id,
      generation: e.candidate.generation,
      bias: e.candidate.bias,
      weights: e.candidate.weights,
      metrics: {
        sharpe: e.metrics.sharpe,
        cumulativeReturn: e.metrics.cumulativeReturn,
        maxDrawdown: e.metrics.maxDrawdown,
        pValue: e.pValue,
        accepted: e.accepted,
      },
    })),
  });
  mkdirSync(registryDir, { recursive: true });
  writeFileSync(
    resolve(registryDir, "factors.json"),
    JSON.stringify(registry, null, 2),
    "utf8",
  );
  return FactorMiningReportSchema.parse({
    generatedAt: new Date().toISOString(),
    source: { logsDir: resolve(logsBaseDir, "daily"), rows: rows.length },
    config,
    acceptedCount,
    top: top.map((e) => ({
      factor: e.candidate,
      sharpe: e.metrics.sharpe,
      cumulativeReturn: e.metrics.cumulativeReturn,
      maxDrawdown: e.metrics.maxDrawdown,
      pValue: e.pValue,
      accepted: e.accepted,
    })),
  });
}
