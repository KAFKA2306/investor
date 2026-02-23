import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { core } from "../../core/index.ts";
import {
  evaluateFactorCandidates,
  loadFeatureRows,
} from "./evaluate_candidates.ts";
import {
  type FactorExpression,
  FactorExpressionSchema,
  generateFactorCandidates,
} from "./generate_candidates.ts";

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
      totalReturn: z.number(),
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
        totalReturn: z.number(),
        maxDrawdown: z.number(),
        pValue: z.number(),
        accepted: z.boolean(),
      }),
    }),
  ),
});

type Evaluated = ReturnType<typeof evaluateFactorCandidates>[number];

function mutateFromElite(
  elites: readonly Evaluated[],
  needed: number,
  generation: number,
): FactorExpression[] {
  const createdAt = new Date().toISOString();
  const out: FactorExpression[] = [];
  for (let i = 0; i < needed; i++) {
    const base = elites[i % Math.max(1, elites.length)]?.candidate;
    if (!base) continue;

    const drift = (i % 5) * 0.03;
    const weights = Object.fromEntries(
      Object.entries(base.weights).map(([k, v], idx) => [
        k,
        v + (idx % 2 === 0 ? drift : -drift),
      ]),
    );

    out.push(
      FactorExpressionSchema.parse({
        id: `factor-g${generation}-m${String(i + 1).padStart(3, "0")}`,
        generation,
        bias: base.bias + (i % 2 === 0 ? 0.02 : -0.02),
        weights,
        createdAt,
      }),
    );
  }
  return out;
}

export function runFactorMining(logsBaseDir: string, registryDir: string) {
  const rows = loadFeatureRows(logsBaseDir);
  if (rows.length < 2) {
    throw new Error("Factor mining requires at least 2 daily rows.");
  }

  const featureNames = Object.keys(rows[0]?.features ?? {});
  const config = {
    generations: 3,
    candidatesPerGeneration: 24,
    eliteCount: 6,
  } as const;

  let pool = generateFactorCandidates(
    featureNames,
    config.candidatesPerGeneration,
    0,
  );
  let scored = evaluateFactorCandidates(rows, pool);

  for (let generation = 1; generation < config.generations; generation++) {
    const elites = scored.slice(0, config.eliteCount);
    const mutated = mutateFromElite(
      elites,
      config.candidatesPerGeneration - elites.length,
      generation,
    );
    const randoms = generateFactorCandidates(
      featureNames,
      Math.max(
        0,
        config.candidatesPerGeneration - elites.length - mutated.length,
      ),
      generation,
      260214670 + generation,
    );
    pool = [...elites.map((e) => e.candidate), ...mutated, ...randoms];
    scored = evaluateFactorCandidates(rows, pool);
  }

  const top = scored.slice(0, 10);
  const acceptedCount = top.filter((t) => t.accepted).length;

  const registry = FactorRegistrySchema.parse({
    version: "1.0.0",
    updatedAt: new Date().toISOString().slice(0, 10),
    factors: top.map((entry) => ({
      id: entry.candidate.id,
      generation: entry.candidate.generation,
      bias: entry.candidate.bias,
      weights: entry.candidate.weights,
      metrics: {
        sharpe: entry.metrics.sharpe,
        totalReturn: entry.metrics.totalReturn,
        maxDrawdown: entry.metrics.maxDrawdown,
        pValue: entry.pValue,
        accepted: entry.accepted,
      },
    })),
  });

  mkdirSync(registryDir, { recursive: true });
  writeFileSync(
    resolve(registryDir, "factors.json"),
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );

  const report = FactorMiningReportSchema.parse({
    generatedAt: new Date().toISOString(),
    source: {
      logsDir: resolve(logsBaseDir, "daily"),
      rows: rows.length,
    },
    config,
    acceptedCount,
    top: top.map((entry) => ({
      factor: entry.candidate,
      sharpe: entry.metrics.sharpe,
      totalReturn: entry.metrics.totalReturn,
      maxDrawdown: entry.metrics.maxDrawdown,
      pValue: entry.pValue,
      accepted: entry.accepted,
    })),
  });

  return report;
}

if (import.meta.main) {
  const logsBaseDir = core.config.paths.logs;
  const registryDir = resolve(process.cwd(), "src/model_registry");
  const report = runFactorMining(logsBaseDir, registryDir);
  console.log(JSON.stringify(report, null, 2));
}
