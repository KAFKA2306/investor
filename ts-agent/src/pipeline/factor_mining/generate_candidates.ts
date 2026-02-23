import { z } from "zod";

export const FactorExpressionSchema = z.object({
  id: z.string().min(1),
  bias: z.number(),
  weights: z.record(z.string(), z.number()),
  createdAt: z.string().datetime(),
  generation: z.number().int().nonnegative(),
});

export type FactorExpression = z.infer<typeof FactorExpressionSchema>;

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomWeight(rand: () => number): number {
  return (rand() * 2 - 1) * 2;
}

export function generateFactorCandidates(
  featureNames: readonly string[],
  candidateCount: number,
  generation = 0,
  seed = 260214670,
): FactorExpression[] {
  const rand = lcg(seed + generation * 9973);
  const createdAt = new Date().toISOString();

  const candidates = Array.from({ length: candidateCount }, (_, idx) => {
    const weights = Object.fromEntries(
      featureNames.map((name) => [name, randomWeight(rand)]),
    );
    const candidate = {
      id: `factor-g${generation}-${String(idx + 1).padStart(3, "0")}`,
      bias: randomWeight(rand),
      weights,
      createdAt,
      generation,
    };
    return FactorExpressionSchema.parse(candidate);
  });

  return candidates;
}
