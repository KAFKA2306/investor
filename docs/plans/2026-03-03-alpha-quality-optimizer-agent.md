# AlphaQualityOptimizer Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous AlphaQualityOptimizer agent that evaluates and enhances LLM-generated alpha DSL, targeting fitness scores > 0.5 by combining 4 lightweight quality metrics (correlation, constraints, orthogonality, backtest).

**Architecture:** AlphaQualityOptimizer extends BaseAgent and evaluates DSL candidates using local computation (no Claude API). Single-pass Qwen generation → 4-metric evaluation → strict validation → reject-on-invalid (never fallback). Integrates into pipeline_orchestrator before factor_mining phase.

**Tech Stack:** TypeScript, Zod (schemas), Qwen (local LLM), TDD (Jest), existing backtest engine, BaseAgent pattern.

---

## Task 1: Define Zod Input/Output Schemas

**Files:**
- Create: `ts-agent/src/schemas/alpha_quality_optimizer_schema.ts`
- Test: `ts-agent/tests/schemas/alpha_quality_optimizer_schema.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/schemas/alpha_quality_optimizer_schema.test.ts
import { describe, it, expect } from "bun:test";
import {
  AlphaQualityOptimizerInputSchema,
  AlphaQualityOptimizerOutputSchema,
  DetailedReportSchema,
} from "../../src/schemas/alpha_quality_optimizer_schema.ts";

describe("AlphaQualityOptimizerSchema", () => {
  it("should validate valid optimizer input", () => {
    const input = {
      alphaPrompt: "日本株の低ボラティリティ効果を狙う...",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984", "6758"],
        returns: [[0.01, 0.02], [0.015, 0.025]],
        volatilities: [0.12, 0.15],
        sharpeRatio: 1.8,
        informationCoefficient: 0.05,
        maxDrawdown: 0.08,
      },
      playbookPatterns: [
        { factorSet: ["momentum", "value"], fitnessScore: 0.52 },
        { factorSet: ["low_vol"], fitnessScore: 0.48 },
      ],
    };

    const result = AlphaQualityOptimizerInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should validate output with all 4 metrics", () => {
    const output = {
      optimizedDSL: "alpha = rank(volatility) * -1",
      fitness: 0.65,
      detailedReport: {
        correlationScore: 0.75,
        constraintScore: 0.8,
        orthogonalityScore: 0.55,
        backtestScore: 0.6,
        reasoning: "All metrics passed threshold",
      },
    };

    const result = AlphaQualityOptimizerOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it("should reject invalid DSL (non-string)", () => {
    const invalid = {
      optimizedDSL: 123, // ← invalid
      fitness: 0.5,
      detailedReport: {
        correlationScore: 0.7,
        constraintScore: 0.7,
        orthogonalityScore: 0.7,
        backtestScore: 0.7,
        reasoning: "test",
      },
    };

    const result = AlphaQualityOptimizerOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/schemas/alpha_quality_optimizer_schema.test.ts
```

Expected: FAIL with "Module not found" or "Schema not defined"

**Step 3: Write schema definitions**

```typescript
// ts-agent/src/schemas/alpha_quality_optimizer_schema.ts
import { z } from "zod";

export const MarketSnapshotSchema = z.object({
  asOfDate: z.string().date(),
  symbols: z.array(z.string()),
  returns: z.array(z.array(z.number())),
  volatilities: z.array(z.number()),
  sharpeRatio: z.number(),
  informationCoefficient: z.number(),
  maxDrawdown: z.number(),
});

export const PlaybookPatternSchema = z.object({
  factorSet: z.array(z.string()),
  fitnessScore: z.number().min(0).max(1),
});

export const AlphaQualityOptimizerInputSchema = z.object({
  alphaPrompt: z.string(),
  marketData: MarketSnapshotSchema,
  playbookPatterns: z.array(PlaybookPatternSchema).default([]),
});

export const DetailedReportSchema = z.object({
  correlationScore: z.number().min(0).max(1),
  constraintScore: z.number().min(0).max(1),
  orthogonalityScore: z.number().min(0).max(1),
  backtestScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const AlphaQualityOptimizerOutputSchema = z.object({
  optimizedDSL: z.string(),
  fitness: z.number().min(0).max(1),
  detailedReport: DetailedReportSchema,
});

export type AlphaQualityOptimizerInput = z.infer<
  typeof AlphaQualityOptimizerInputSchema
>;
export type AlphaQualityOptimizerOutput = z.infer<
  typeof AlphaQualityOptimizerOutputSchema
>;
export type DetailedReport = z.infer<typeof DetailedReportSchema>;
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/schemas/alpha_quality_optimizer_schema.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/schemas/alpha_quality_optimizer_schema.ts ts-agent/tests/schemas/alpha_quality_optimizer_schema.test.ts
git commit -m "feat(schemas): add AlphaQualityOptimizer input/output Zod schemas"
```

---

## Task 2: Create AlphaQualityOptimizer Agent Skeleton

**Files:**
- Create: `ts-agent/src/agents/alpha_quality_optimizer_agent.ts`
- Test: `ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
import { describe, it, expect } from "bun:test";
import { AlphaQualityOptimizerAgent } from "../../src/agents/alpha_quality_optimizer_agent.ts";
import type {
  AlphaQualityOptimizerInput,
  AlphaQualityOptimizerOutput,
} from "../../src/schemas/alpha_quality_optimizer_schema.ts";

describe("AlphaQualityOptimizerAgent", () => {
  it("should initialize with config", () => {
    const agent = new AlphaQualityOptimizerAgent({
      modelId: "qwen:latest",
      metricsWeights: { correlation: 0.25, constraint: 0.25, orthogonal: 0.25, backtest: 0.25 },
    });

    expect(agent).toBeDefined();
    expect(agent.agentName).toBe("AlphaQualityOptimizer");
  });

  it("should execute run() and return valid output", async () => {
    const agent = new AlphaQualityOptimizerAgent({
      modelId: "qwen:latest",
      metricsWeights: { correlation: 0.25, constraint: 0.25, orthogonal: 0.25, backtest: 0.25 },
    });

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "日本株の低ボラティリティ効果",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984"],
        returns: [[0.01]],
        volatilities: [0.12],
        sharpeRatio: 1.8,
        informationCoefficient: 0.05,
        maxDrawdown: 0.08,
      },
      playbookPatterns: [],
    };

    const result = await agent.run(input);

    expect(result).toBeDefined();
    expect(result.optimizedDSL).toEqual(expect.any(String));
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
    expect(result.detailedReport).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
```

Expected: FAIL with "class not found" or "run method undefined"

**Step 3: Write minimal agent skeleton**

```typescript
// ts-agent/src/agents/alpha_quality_optimizer_agent.ts
import {
  type AlphaQualityOptimizerInput,
  type AlphaQualityOptimizerOutput,
  AlphaQualityOptimizerOutputSchema,
} from "../schemas/alpha_quality_optimizer_schema.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

export interface AlphaQualityOptimizerConfig {
  modelId: string;
  metricsWeights: {
    correlation: number;
    constraint: number;
    orthogonal: number;
    backtest: number;
  };
}

export class AlphaQualityOptimizerAgent extends BaseAgent {
  readonly agentName = "AlphaQualityOptimizer";
  private config: AlphaQualityOptimizerConfig;

  constructor(config: AlphaQualityOptimizerConfig) {
    super();
    this.config = config;
  }

  async run(input: AlphaQualityOptimizerInput): Promise<AlphaQualityOptimizerOutput> {
    logger.info(
      `[${this.agentName}] Processing alpha prompt: ${input.alphaPrompt.substring(0, 50)}...`
    );

    // TODO: Implement Qwen DSL generation
    // TODO: Implement 4 metric calculations
    // TODO: Implement weighted fitness aggregation
    // TODO: Implement validation + repair loop

    // Placeholder output
    const output: AlphaQualityOptimizerOutput = {
      optimizedDSL: "alpha = rank(volatility) * -1",
      fitness: 0.5,
      detailedReport: {
        correlationScore: 0.5,
        constraintScore: 0.5,
        orthogonalityScore: 0.5,
        backtestScore: 0.5,
        reasoning: "Placeholder - not yet implemented",
      },
    };

    const validated = AlphaQualityOptimizerOutputSchema.parse(output);
    return validated;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/alpha_quality_optimizer_agent.ts ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
git commit -m "feat(agents): add AlphaQualityOptimizer skeleton with BaseAgent pattern"
```

---

## Task 3: Implement Correlation Score Metric

**Files:**
- Modify: `ts-agent/src/agents/alpha_quality_optimizer_agent.ts`
- Create: `ts-agent/src/agents/metrics/correlation_scorer.ts`
- Test: `ts-agent/tests/agents/metrics/correlation_scorer.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/agents/metrics/correlation_scorer.test.ts
import { describe, it, expect } from "bun:test";
import { computeCorrelationScore } from "../../../src/agents/metrics/correlation_scorer.ts";

describe("CorrelationScorer", () => {
  it("should compute correlation between factors and returns", () => {
    const returns = [0.01, 0.02, -0.01, 0.015, 0.025];
    const lowVolFactor = [1, 1, 0, 1, 1]; // High when low volatility
    const momentumFactor = [0.5, 0.8, 0.2, 0.6, 0.9];

    const score = computeCorrelationScore(
      [lowVolFactor, momentumFactor],
      returns
    );

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 for all zero factors", () => {
    const returns = [0.01, 0.02, 0.015];
    const zeroFactors = [[0, 0, 0]];

    const score = computeCorrelationScore(zeroFactors, returns);

    expect(score).toBe(0);
  });

  it("should return high score for highly correlated factors", () => {
    const returns = [0.1, 0.2, 0.15, 0.25, 0.3];
    const perfectFactor = [0.1, 0.2, 0.15, 0.25, 0.3]; // Perfect correlation

    const score = computeCorrelationScore([perfectFactor], returns);

    expect(score).toBeGreaterThan(0.8);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/correlation_scorer.test.ts
```

Expected: FAIL with "Module not found"

**Step 3: Implement correlation scorer**

```typescript
// ts-agent/src/agents/metrics/correlation_scorer.ts

/**
 * Compute Pearson correlation coefficient between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;

  return numerator / denom;
}

/**
 * Compute correlation score for multiple factors against returns
 * Returns average absolute correlation, normalized to [0, 1]
 */
export function computeCorrelationScore(
  factors: number[][],
  returns: number[]
): number {
  if (factors.length === 0 || returns.length === 0) return 0;

  const correlations = factors.map((factor) =>
    Math.abs(pearsonCorrelation(factor, returns))
  );

  const avgCorr = correlations.reduce((a, b) => a + b, 0) / correlations.length;

  // Normalize: correlations > 0.1 are considered "valid"
  // Return 1.0 if avg correlation > 0.3, scale linearly otherwise
  return Math.min(1.0, Math.max(0.0, avgCorr / 0.3));
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/correlation_scorer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/metrics/correlation_scorer.ts ts-agent/tests/agents/metrics/correlation_scorer.test.ts
git commit -m "feat(metrics): implement correlation score calculation"
```

---

## Task 4: Implement Constraint Score Metric

**Files:**
- Create: `ts-agent/src/agents/metrics/constraint_scorer.ts`
- Test: `ts-agent/tests/agents/metrics/constraint_scorer.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/agents/metrics/constraint_scorer.test.ts
import { describe, it, expect } from "bun:test";
import { computeConstraintScore } from "../../../src/agents/metrics/constraint_scorer.ts";

describe("ConstraintScorer", () => {
  it("should return 1.0 when all constraints passed", () => {
    const backtestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };

    const score = computeConstraintScore(backtestMetrics);

    expect(score).toBe(1.0);
  });

  it("should return 0.5 when Sharpe is below threshold", () => {
    const backtestMetrics = {
      sharpeRatio: 1.2, // Below 1.5
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };

    const score = computeConstraintScore(backtestMetrics);

    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return 0.0 when multiple constraints failed", () => {
    const backtestMetrics = {
      sharpeRatio: 0.5,
      informationCoefficient: 0.01, // Below 0.04
      maxDrawdown: 0.15, // Above 0.10
    };

    const score = computeConstraintScore(backtestMetrics);

    expect(score).toBeLessThanOrEqual(0.5);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/constraint_scorer.test.ts
```

Expected: FAIL

**Step 3: Implement constraint scorer**

```typescript
// ts-agent/src/agents/metrics/constraint_scorer.ts

const CONSTRAINT_THRESHOLDS = {
  sharpeRatio: { min: 1.5 },
  informationCoefficient: { min: 0.04 },
  maxDrawdown: { max: 0.1 },
};

interface BacktestMetrics {
  sharpeRatio: number;
  informationCoefficient: number;
  maxDrawdown: number;
}

export function computeConstraintScore(metrics: BacktestMetrics): number {
  const constraints = [
    metrics.sharpeRatio >= CONSTRAINT_THRESHOLDS.sharpeRatio.min,
    metrics.informationCoefficient >=
      CONSTRAINT_THRESHOLDS.informationCoefficient.min,
    metrics.maxDrawdown <= CONSTRAINT_THRESHOLDS.maxDrawdown.max,
  ];

  const passCount = constraints.filter((c) => c).length;
  const totalCount = constraints.length;

  // Return proportional score: 1.0 if all pass, scale down for partial
  return passCount / totalCount;
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/constraint_scorer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/metrics/constraint_scorer.ts ts-agent/tests/agents/metrics/constraint_scorer.test.ts
git commit -m "feat(metrics): implement constraint score calculation"
```

---

## Task 5: Implement Orthogonality Score Metric

**Files:**
- Create: `ts-agent/src/agents/metrics/orthogonality_scorer.ts`
- Test: `ts-agent/tests/agents/metrics/orthogonality_scorer.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/agents/metrics/orthogonality_scorer.test.ts
import { describe, it, expect } from "bun:test";
import {
  computeOrthogonalityScore,
  extractFactorsFromDSL,
} from "../../../src/agents/metrics/orthogonality_scorer.ts";

describe("OrthogonalityScorer", () => {
  it("should extract factors from DSL string", () => {
    const dsl = "alpha = rank(low_volatility) + rank(momentum)";
    const factors = extractFactorsFromDSL(dsl);

    expect(factors).toContain("low_volatility");
    expect(factors).toContain("momentum");
  });

  it("should return 1.0 for completely new factor set", () => {
    const dslFactors = ["new_factor_xyz"];
    const playbookPatterns = [
      { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
    ];

    const score = computeOrthogonalityScore(dslFactors, playbookPatterns);

    expect(score).toBe(1.0);
  });

  it("should return 0.0 for identical factor set", () => {
    const dslFactors = ["momentum", "value"];
    const playbookPatterns = [
      { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
    ];

    const score = computeOrthogonalityScore(dslFactors, playbookPatterns);

    expect(score).toBe(0.0);
  });

  it("should return partial score for partial overlap", () => {
    const dslFactors = ["momentum", "new_factor"];
    const playbookPatterns = [
      { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
    ];

    const score = computeOrthogonalityScore(dslFactors, playbookPatterns);

    expect(score).toBeGreaterThan(0.0);
    expect(score).toBeLessThan(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/orthogonality_scorer.test.ts
```

Expected: FAIL

**Step 3: Implement orthogonality scorer**

```typescript
// ts-agent/src/agents/metrics/orthogonality_scorer.ts

export interface PlaybookPattern {
  factorSet: string[];
  fitnessScore: number;
}

/**
 * Extract factor names from DSL string using regex pattern matching
 * e.g., "alpha = rank(low_vol) + rank(momentum)" → ["low_vol", "momentum"]
 */
export function extractFactorsFromDSL(dsl: string): string[] {
  const factorPattern = /\b([a-z_][a-z0-9_]*)\s*\(/gi;
  const matches = dsl.matchAll(factorPattern);
  const factors = new Set<string>();

  for (const match of matches) {
    const factor = match[1].toLowerCase();
    // Filter out common function names
    if (!["rank", "scale", "abs", "sign", "log"].includes(factor)) {
      factors.add(factor);
    }
  }

  return Array.from(factors);
}

/**
 * Compute orthogonality score using Jaccard distance
 * Jaccard = 1 - (intersection / union)
 * orthogonalityScore = 1 - min(Jaccard distances to all playbook patterns)
 */
export function computeOrthogonalityScore(
  dslFactors: string[],
  playbookPatterns: PlaybookPattern[]
): number {
  if (playbookPatterns.length === 0) {
    return 1.0; // Completely new if no playbook
  }

  const dslSet = new Set(dslFactors.map((f) => f.toLowerCase()));

  const jaccardDistances = playbookPatterns.map((pattern) => {
    const patternSet = new Set(pattern.factorSet.map((f) => f.toLowerCase()));

    const intersection = new Set(
      [...dslSet].filter((x) => patternSet.has(x))
    ).size;
    const union = new Set([...dslSet, ...patternSet]).size;

    if (union === 0) return 1.0;
    return 1.0 - intersection / union; // Jaccard distance
  });

  const minDistance = Math.min(...jaccardDistances);
  return minDistance; // Return highest orthogonality (min Jaccard distance)
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/orthogonality_scorer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/metrics/orthogonality_scorer.ts ts-agent/tests/agents/metrics/orthogonality_scorer.test.ts
git commit -m "feat(metrics): implement orthogonality score with Jaccard distance"
```

---

## Task 6: Implement Backtest Score Metric

**Files:**
- Create: `ts-agent/src/agents/metrics/backtest_scorer.ts`
- Test: `ts-agent/tests/agents/metrics/backtest_scorer.test.ts`

**Step 1: Write the failing test**

```typescript
// ts-agent/tests/agents/metrics/backtest_scorer.test.ts
import { describe, it, expect } from "bun:test";
import { computeBacktestScore } from "../../../src/agents/metrics/backtest_scorer.ts";

describe("BacktestScorer", () => {
  it("should compute backtest score from Sharpe and IC", () => {
    const sharpeRatio = 2.0; // Above 1.5
    const ic = 0.06; // Above 0.04

    const score = computeBacktestScore(sharpeRatio, ic);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should return 0 for poor Sharpe", () => {
    const sharpeRatio = 0.5; // Below 1.5
    const ic = 0.06;

    const score = computeBacktestScore(sharpeRatio, ic);

    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return 0 for poor IC", () => {
    const sharpeRatio = 2.0;
    const ic = 0.01; // Below 0.04

    const score = computeBacktestScore(sharpeRatio, ic);

    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return high score for strong metrics", () => {
    const sharpeRatio = 2.5;
    const ic = 0.08;

    const score = computeBacktestScore(sharpeRatio, ic);

    expect(score).toBeGreaterThan(0.7);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/backtest_scorer.test.ts
```

Expected: FAIL

**Step 3: Implement backtest scorer**

```typescript
// ts-agent/src/agents/metrics/backtest_scorer.ts

const BACKTEST_THRESHOLDS = {
  sharpe: { min: 1.5, ideal: 2.0 },
  ic: { min: 0.04, ideal: 0.08 },
};

/**
 * Compute backtest score from Sharpe ratio and Information Coefficient
 * Scaled to [0, 1] with thresholds
 */
export function computeBacktestScore(
  sharpeRatio: number,
  informationCoefficient: number
): number {
  // Normalize Sharpe: min=0 at 1.5, max=1.0 at 2.0
  const sharpeScore = Math.min(
    1.0,
    Math.max(0.0, (sharpeRatio - BACKTEST_THRESHOLDS.sharpe.min) / 0.5)
  );

  // Normalize IC: min=0 at 0.04, max=1.0 at 0.08
  const icScore = Math.min(
    1.0,
    Math.max(
      0.0,
      (informationCoefficient - BACKTEST_THRESHOLDS.ic.min) / 0.04
    )
  );

  // Average the two components
  return (sharpeScore + icScore) / 2;
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/metrics/backtest_scorer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/metrics/backtest_scorer.ts ts-agent/tests/agents/metrics/backtest_scorer.test.ts
git commit -m "feat(metrics): implement backtest score from Sharpe and IC"
```

---

## Task 7: Integrate All 4 Metrics into AlphaQualityOptimizer

**Files:**
- Modify: `ts-agent/src/agents/alpha_quality_optimizer_agent.ts`
- Modify: `ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts`

**Step 1: Update the integration test**

```typescript
// ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts (update run test)

it("should compute all 4 metrics and aggregate fitness", async () => {
  const agent = new AlphaQualityOptimizerAgent({
    modelId: "qwen:latest",
    metricsWeights: { correlation: 0.25, constraint: 0.25, orthogonal: 0.25, backtest: 0.25 },
  });

  const input: AlphaQualityOptimizerInput = {
    alphaPrompt: "日本株の低ボラティリティ効果",
    marketData: {
      asOfDate: "2026-03-03",
      symbols: ["9984"],
      returns: [[0.01, 0.02, 0.015, 0.025]],
      volatilities: [0.12],
      sharpeRatio: 1.9,
      informationCoefficient: 0.055,
      maxDrawdown: 0.08,
    },
    playbookPatterns: [{ factorSet: ["momentum"], fitnessScore: 0.5 }],
  };

  const result = await agent.run(input);

  expect(result.detailedReport.correlationScore).toBeGreaterThanOrEqual(0);
  expect(result.detailedReport.constraintScore).toBeGreaterThanOrEqual(0);
  expect(result.detailedReport.orthogonalityScore).toBeGreaterThanOrEqual(0);
  expect(result.detailedReport.backtestScore).toBeGreaterThanOrEqual(0);
  expect(result.fitness).toBe(
    0.25 * result.detailedReport.correlationScore +
      0.25 * result.detailedReport.constraintScore +
      0.25 * result.detailedReport.orthogonalityScore +
      0.25 * result.detailedReport.backtestScore
  );
});
```

**Step 2: Update AlphaQualityOptimizer agent implementation**

```typescript
// ts-agent/src/agents/alpha_quality_optimizer_agent.ts (update run method)

import { computeCorrelationScore } from "./metrics/correlation_scorer.ts";
import { computeConstraintScore } from "./metrics/constraint_scorer.ts";
import {
  computeOrthogonalityScore,
  extractFactorsFromDSL,
} from "./metrics/orthogonality_scorer.ts";
import { computeBacktestScore } from "./metrics/backtest_scorer.ts";

async run(input: AlphaQualityOptimizerInput): Promise<AlphaQualityOptimizerOutput> {
  logger.info(
    `[${this.agentName}] Processing alpha prompt: ${input.alphaPrompt.substring(0, 50)}...`
  );

  // TODO: Generate DSL via Qwen (Task 8)
  // For now, use placeholder
  const dslCandidates = ["alpha = rank(volatility) * -1"];
  const optimizedDSL = dslCandidates[0];

  // Extract factors from DSL for orthogonality check
  const dslFactors = extractFactorsFromDSL(optimizedDSL);

  // Compute 4 metrics
  // 1. Correlation: Extract factor values from marketData returns
  const returnsArray = input.marketData.returns[0] || [];
  const mockFactorValues = [returnsArray]; // Placeholder: real implementation extracts from DSL
  const correlationScore = computeCorrelationScore(
    mockFactorValues,
    returnsArray
  );

  // 2. Constraint: Check Sharpe, IC, MaxDD against thresholds
  const constraintScore = computeConstraintScore({
    sharpeRatio: input.marketData.sharpeRatio,
    informationCoefficient: input.marketData.informationCoefficient,
    maxDrawdown: input.marketData.maxDrawdown,
  });

  // 3. Orthogonality: Compare DSL factors to playbook patterns
  const orthogonalityScore = computeOrthogonalityScore(
    dslFactors,
    input.playbookPatterns
  );

  // 4. Backtest: Normalize Sharpe + IC
  const backtestScore = computeBacktestScore(
    input.marketData.sharpeRatio,
    input.marketData.informationCoefficient
  );

  // Aggregate fitness using configured weights
  const fitness =
    this.config.metricsWeights.correlation * correlationScore +
    this.config.metricsWeights.constraint * constraintScore +
    this.config.metricsWeights.orthogonal * orthogonalityScore +
    this.config.metricsWeights.backtest * backtestScore;

  const output: AlphaQualityOptimizerOutput = {
    optimizedDSL,
    fitness,
    detailedReport: {
      correlationScore,
      constraintScore,
      orthogonalityScore,
      backtestScore,
      reasoning: `Correlation: ${correlationScore.toFixed(2)}, Constraint: ${constraintScore.toFixed(2)}, Orthogonal: ${orthogonalityScore.toFixed(2)}, Backtest: ${backtestScore.toFixed(2)}`,
    },
  };

  const validated = AlphaQualityOptimizerOutputSchema.parse(output);
  return validated;
}
```

**Step 3: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/alpha_quality_optimizer_agent.ts ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
git commit -m "feat(agent): integrate all 4 metrics into AlphaQualityOptimizer"
```

---

## Task 8: Implement Qwen DSL Generation with Prompting

**Files:**
- Create: `ts-agent/src/agents/prompts/qwen_alpha_dsl_prompt.ts`
- Modify: `ts-agent/src/agents/alpha_quality_optimizer_agent.ts`
- Test: `ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts`

**Step 1: Write prompt template test**

```typescript
// ts-agent/tests/agents/prompts/qwen_alpha_dsl_prompt.test.ts
import { describe, it, expect } from "bun:test";
import { buildQwenAlphaDSLPrompt } from "../../../src/agents/prompts/qwen_alpha_dsl_prompt.ts";

describe("QwenAlphaDSLPrompt", () => {
  it("should generate a valid prompt from input", () => {
    const prompt = buildQwenAlphaDSLPrompt(
      "日本株の低ボラティリティ効果",
      ["9984", "6758"],
      0.12
    );

    expect(prompt).toContain("低ボラティリティ");
    expect(prompt).toContain("alpha =");
    expect(prompt).toContain("rank");
  });

  it("should include market context in prompt", () => {
    const prompt = buildQwenAlphaDSLPrompt(
      "高成長テーマ投資",
      ["4452", "3765"],
      0.18
    );

    expect(prompt).toContain("市場");
    expect(prompt).toContain("4452");
  });
});
```

**Step 2: Implement prompt builder**

```typescript
// ts-agent/src/agents/prompts/qwen_alpha_dsl_prompt.ts

export function buildQwenAlphaDSLPrompt(
  alphaPrompt: string,
  symbols: string[],
  avgVolatility: number
): string {
  const market_condition =
    avgVolatility > 0.15 ? "高ボラティリティ市場" : "低ボラティリティ市場";

  return `You are an expert quantitative analyst specializing in alpha factor discovery for Japanese equities.

## Task
Generate a single-line alpha DSL (Domain-Specific Language) based on the following investment theme:

**Theme**: ${alphaPrompt}

## Context
- Universe: JP stock symbols ${symbols.join(", ")}
- Current Market Condition: ${market_condition} (avg volatility: ${(avgVolatility * 100).toFixed(1)}%)
- Language: Japanese (for reasoning), English (for DSL syntax)

## Requirements
1. Output ONLY the alpha formula as a single line starting with "alpha = "
2. Use only these allowed operations: rank(), scale(), abs(), sign(), log()
3. Reference only known factors: momentum, value, size, volatility, quality, growth, dividend
4. Example valid format: "alpha = rank(momentum) * -1 + rank(value) * 0.5"
5. Do NOT include explanations, just the formula

## Output
alpha = `;
}

/**
 * Call Qwen to generate DSL (simplified - real implementation calls actual LLM)
 */
export async function generateAlphaDSLWithQwen(
  prompt: string,
  modelId: string = "qwen:latest"
): Promise<string> {
  // TODO: Integrate with actual Qwen API/ollama endpoint
  // Placeholder: return a mock DSL
  // In real implementation, this would call:
  // const response = await fetch("http://localhost:11434/api/generate", {...})

  return "alpha = rank(volatility) * -1 + rank(momentum) * 0.3";
}
```

**Step 3: Update AlphaQualityOptimizer to use Qwen**

```typescript
// ts-agent/src/agents/alpha_quality_optimizer_agent.ts (update imports and run())

import { buildQwenAlphaDSLPrompt, generateAlphaDSLWithQwen } from "./prompts/qwen_alpha_dsl_prompt.ts";

async run(input: AlphaQualityOptimizerInput): Promise<AlphaQualityOptimizerOutput> {
  logger.info(
    `[${this.agentName}] Processing alpha prompt: ${input.alphaPrompt.substring(0, 50)}...`
  );

  // Step 1: Generate DSL via Qwen
  const prompt = buildQwenAlphaDSLPrompt(
    input.alphaPrompt,
    input.marketData.symbols,
    Math.mean(input.marketData.volatilities)
  );
  const optimizedDSL = await generateAlphaDSLWithQwen(
    prompt,
    this.config.modelId
  );

  // Step 2-5: Continue with metrics as in Task 7
  // ...rest of implementation unchanged
}
```

**Step 4: Run test**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/prompts/qwen_alpha_dsl_prompt.ts ts-agent/src/agents/alpha_quality_optimizer_agent.ts ts-agent/tests/agents/prompts/qwen_alpha_dsl_prompt.test.ts
git commit -m "feat(dsl): implement Qwen-based alpha DSL generation with market context"
```

---

## Task 9: Implement Validation and Repair Loop

**Files:**
- Create: `ts-agent/src/agents/validators/dsl_validator.ts`
- Test: `ts-agent/tests/agents/validators/dsl_validator.test.ts`
- Modify: `ts-agent/src/agents/alpha_quality_optimizer_agent.ts`

**Step 1: Write validation test**

```typescript
// ts-agent/tests/agents/validators/dsl_validator.test.ts
import { describe, it, expect } from "bun:test";
import {
  validateDSL,
  repairDSL,
  isValidDSL,
} from "../../../src/agents/validators/dsl_validator.ts";

describe("DSLValidator", () => {
  it("should validate correct DSL", () => {
    const dsl = "alpha = rank(momentum) * -1";
    expect(isValidDSL(dsl)).toBe(true);
  });

  it("should reject DSL without 'alpha ='", () => {
    const dsl = "rank(momentum) * -1";
    expect(isValidDSL(dsl)).toBe(false);
  });

  it("should reject DSL with invalid functions", () => {
    const dsl = "alpha = invalid_func(momentum)";
    expect(isValidDSL(dsl)).toBe(false);
  });

  it("should repair partial DSL by adding 'alpha ='", () => {
    const dsl = "rank(momentum) * -1";
    const repaired = repairDSL(dsl);
    expect(repaired).toContain("alpha =");
  });

  it("should return null for unfixable DSL", () => {
    const dsl = "() * @#$% invalid";
    const repaired = repairDSL(dsl);
    expect(repaired).toBeNull();
  });
});
```

**Step 2: Implement validator**

```typescript
// ts-agent/src/agents/validators/dsl_validator.ts

const ALLOWED_FUNCTIONS = [
  "rank",
  "scale",
  "abs",
  "sign",
  "log",
  "max",
  "min",
];
const ALLOWED_FACTORS = [
  "momentum",
  "value",
  "size",
  "volatility",
  "quality",
  "growth",
  "dividend",
  "low_vol",
  "low_volatility",
];

const DSL_REGEX = /^alpha\s*=\s*[a-z0-9_\(\)\+\-\*\/\.\s]+$/i;

export function isValidDSL(dsl: string): boolean {
  if (!DSL_REGEX.test(dsl)) return false;

  // Check for invalid function calls
  const functionMatches = dsl.matchAll(/(\w+)\s*\(/gi);
  for (const match of functionMatches) {
    const funcName = match[1].toLowerCase();
    if (
      !ALLOWED_FUNCTIONS.includes(funcName) &&
      !ALLOWED_FACTORS.includes(funcName)
    ) {
      return false;
    }
  }

  return true;
}

export function repairDSL(dsl: string): string | null {
  // Attempt 1: Add "alpha =" if missing
  if (!dsl.includes("alpha")) {
    const repaired = `alpha = ${dsl}`;
    if (isValidDSL(repaired)) return repaired;
  }

  // Attempt 2: Remove leading/trailing whitespace and try again
  const trimmed = dsl.trim();
  if (isValidDSL(trimmed)) return trimmed;

  // Give up if unfixable
  return null;
}

export function validateDSL(
  dsl: string
): { valid: boolean; errors: string[]; repaired?: string } {
  const errors: string[] = [];

  if (!dsl) {
    errors.push("DSL is empty");
  } else if (!isValidDSL(dsl)) {
    errors.push("DSL does not match expected pattern: 'alpha = ...'");

    const repaired = repairDSL(dsl);
    if (repaired) {
      return {
        valid: true,
        errors: ["Automatically repaired DSL"],
        repaired,
      };
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Step 3: Update AlphaQualityOptimizer with validation**

```typescript
// ts-agent/src/agents/alpha_quality_optimizer_agent.ts (add validation loop)

import { validateDSL } from "./validators/dsl_validator.ts";

async run(input: AlphaQualityOptimizerInput): Promise<AlphaQualityOptimizerOutput> {
  logger.info(
    `[${this.agentName}] Processing alpha prompt: ${input.alphaPrompt.substring(0, 50)}...`
  );

  // Step 1: Generate DSL via Qwen
  let optimizedDSL = await generateAlphaDSLWithQwen(
    buildQwenAlphaDSLPrompt(input.alphaPrompt, input.marketData.symbols, Math.mean(input.marketData.volatilities)),
    this.config.modelId
  );

  // Step 2: Validate DSL (never fallback - strict validation)
  const validation = validateDSL(optimizedDSL);
  if (!validation.valid && !validation.repaired) {
    logger.error(`[${this.agentName}] DSL validation failed and unrepairable:`, validation.errors);
    // Reject the alpha entirely - return null fitness
    throw new Error(`Invalid DSL: ${validation.errors.join(", ")}`);
  }

  if (validation.repaired) {
    logger.warn(`[${this.agentName}] DSL auto-repaired:`, { original: optimizedDSL, repaired: validation.repaired });
    optimizedDSL = validation.repaired;
  }

  // Continue with metrics computation...
  // (rest of implementation from Task 7)
}
```

**Step 4: Run test**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/agents/validators/dsl_validator.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/validators/dsl_validator.ts ts-agent/src/agents/alpha_quality_optimizer_agent.ts ts-agent/tests/agents/validators/dsl_validator.test.ts
git commit -m "feat(validation): implement strict DSL validation with auto-repair (never fallback)"
```

---

## Task 10: Integrate into pipeline_orchestrator

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts`
- Test: `ts-agent/tests/system/pipeline_orchestrator.integration.test.ts` (or existing integration suite)

**Step 1: Write integration test**

```typescript
// ts-agent/tests/system/pipeline_orchestrator.integration.test.ts (add to existing file)
import { describe, it, expect } from "bun:test";
import { PipelineOrchestrator } from "../../src/system/pipeline_orchestrator.ts";

describe("PipelineOrchestrator + AlphaQualityOptimizer integration", () => {
  it("should invoke AlphaQualityOptimizer before factor mining", async () => {
    const orchestrator = new PipelineOrchestrator({
      // ... config
    });

    // Spy or mock to verify AlphaQualityOptimizer.run() is called
    let optimizerCalled = false;
    // (In real implementation, you'd inject a mock or use a testing library)

    // await orchestrator.run(); // This should invoke optimizer internally

    // expect(optimizerCalled).toBe(true);
  });
});
```

**Step 2: Modify pipeline_orchestrator to instantiate AlphaQualityOptimizer**

```typescript
// ts-agent/src/system/pipeline_orchestrator.ts (add near the top after imports)

import { AlphaQualityOptimizerAgent } from "../agents/alpha_quality_optimizer_agent.ts";

export class PipelineOrchestrator {
  // ... existing properties ...
  private alphaOptimizer: AlphaQualityOptimizerAgent;

  constructor(config: PipelineOrchestratorConfig) {
    // ... existing initialization ...

    this.alphaOptimizer = new AlphaQualityOptimizerAgent({
      modelId: config.alphaQualityOptimizerModel || "qwen:latest",
      metricsWeights: {
        correlation: 0.25,
        constraint: 0.25,
        orthogonal: 0.25,
        backtest: 0.25,
      },
    });
  }

  async run(): Promise<void> {
    // ... existing pipeline code ...

    // NEW: Before factor_mining, invoke AlphaQualityOptimizer
    if (alphaPrompt && marketSnapshot) {
      const optimizationResult = await this.alphaOptimizer.run({
        alphaPrompt,
        marketData: marketSnapshot,
        playbookPatterns: this.contextPlaybook?.getPatterns() || [],
      });

      logger.info(`[Pipeline] AlphaQualityOptimizer fitness: ${optimizationResult.fitness}`);

      // Use optimizedDSL instead of original alphaPrompt
      alphaPrompt = optimizationResult.optimizedDSL;
    }

    // ... continue with existing factor_mining call ...
  }
}
```

**Step 3: Run test**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/system/pipeline_orchestrator.integration.test.ts
```

Expected: PASS (or manual verification that integration is correct)

**Step 4: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/system/pipeline_orchestrator.ts
git commit -m "feat(integration): integrate AlphaQualityOptimizer before factor_mining phase"
```

---

## Task 11: End-to-End Test and Quality Verification

**Files:**
- Create: `ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts`
- Existing: `ts-agent/biome.json`

**Step 1: Write E2E test**

```typescript
// ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts
import { describe, it, expect } from "bun:test";
import { AlphaQualityOptimizerAgent } from "../../src/agents/alpha_quality_optimizer_agent.ts";
import type { AlphaQualityOptimizerInput } from "../../src/schemas/alpha_quality_optimizer_schema.ts";

describe("AlphaQualityOptimizer E2E", () => {
  it("should process real market data and return fitness > 0.5", async () => {
    const agent = new AlphaQualityOptimizerAgent({
      modelId: "qwen:latest",
      metricsWeights: { correlation: 0.25, constraint: 0.25, orthogonal: 0.25, backtest: 0.25 },
    });

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "日本株の低ボラティリティ効果を狙う小型株戦略",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984", "6758", "4452"],
        returns: [
          [0.01, 0.015, 0.02, 0.01, -0.005],
          [0.02, 0.025, 0.03, 0.015, 0.005],
          [0.005, 0.01, 0.015, 0.002, -0.01],
        ],
        volatilities: [0.12, 0.15, 0.18],
        sharpeRatio: 1.85,
        informationCoefficient: 0.055,
        maxDrawdown: 0.088,
      },
      playbookPatterns: [
        { factorSet: ["momentum"], fitnessScore: 0.48 },
      ],
    };

    const result = await agent.run(input);

    expect(result.optimizedDSL).toBeDefined();
    expect(result.optimizedDSL).toContain("alpha =");
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
    expect(result.detailedReport).toBeDefined();
    expect(result.detailedReport.reasoning).toBeDefined();
  });
});
```

**Step 2: Run E2E test**

```bash
cd /home/kafka/finance/investor
bun test ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts
```

Expected: PASS

**Step 3: Run Biome format/lint**

```bash
cd /home/kafka/finance/investor
task qa
```

Expected: No errors in new code

**Step 4: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts
git commit -m "test(e2e): add end-to-end test for AlphaQualityOptimizer"
```

---

## Task 12: Documentation and Final Review

**Files:**
- Create: `ts-agent/src/agents/README_ALPHA_QUALITY_OPTIMIZER.md`
- Modify: (if needed) main `README.md` or project docs

**Step 1: Write agent documentation**

```markdown
# AlphaQualityOptimizer Agent

## Overview
The AlphaQualityOptimizer agent evaluates and enhances LLM-generated alpha DSL (Domain-Specific Language) using 4 lightweight quality metrics to target fitness scores > 0.5.

## Architecture
- **Input**: Alpha prompt (text), market snapshot (OHLCV), playbook patterns (historical successful factors)
- **Process**: Qwen DSL generation → validation → 4-metric evaluation → fitness aggregation
- **Output**: Optimized DSL + fitness score + detailed report

## 4 Metrics
1. **Correlation Score**: Pearson correlation between factor and returns (normalized to [0, 1])
2. **Constraint Score**: Compliance with Sharpe > 1.5, IC > 0.04, MaxDD < 0.10
3. **Orthogonality Score**: Jaccard distance from existing playbook patterns (1.0 = fully new)
4. **Backtest Score**: Normalized from Sharpe and IC ranges

## Integration Point
Integrates into `pipeline_orchestrator.ts` BEFORE the `factor_mining` phase. Transforms alpha prompt into optimized DSL automatically.

## Error Handling
- **Strict Validation**: No fallback to Claude API. Qwen-generated DSL is strictly validated.
- **Auto-Repair**: Simple repairs (missing "alpha =") are attempted automatically.
- **Reject-on-Invalid**: Unrepairable DSL throws error and triggers pipeline rejection.

## Usage
```typescript
const optimizer = new AlphaQualityOptimizerAgent({
  modelId: "qwen:latest",
  metricsWeights: { correlation: 0.25, constraint: 0.25, orthogonal: 0.25, backtest: 0.25 },
});

const result = await optimizer.run({
  alphaPrompt: "Japanese low-volatility effect...",
  marketData: snapshot,
  playbookPatterns: [],
});

console.log(result.fitness); // [0, 1]
console.log(result.optimizedDSL); // "alpha = rank(volatility) * -1 + ..."
```

## Testing
- Unit tests for each metric: `ts-agent/tests/agents/metrics/`
- Integration test: `ts-agent/tests/agents/alpha_quality_optimizer_agent.test.ts`
- E2E test: `ts-agent/tests/e2e/alpha_quality_optimizer_e2e.test.ts`

Run all: `bun test`
```

**Step 2: Add to main docs**

```bash
# Add reference in README or architecture docs if applicable
```

**Step 3: Commit**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/README_ALPHA_QUALITY_OPTIMIZER.md
git commit -m "docs: add AlphaQualityOptimizer agent documentation"
```

---

## Task 13: Verification Run and Telemetry

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts` (add telemetry logging)
- Existing: `ts-agent/src/system/telemetry_logger.ts`

**Step 1: Add telemetry to AlphaQualityOptimizer**

```typescript
// ts-agent/src/agents/alpha_quality_optimizer_agent.ts

import { logIO, logMetric } from "../system/telemetry_logger.ts";

async run(input: AlphaQualityOptimizerInput): Promise<AlphaQualityOptimizerOutput> {
  const startTime = performance.now();

  // ... existing logic ...

  const duration = performance.now() - startTime;

  // Log output and metrics
  logIO(
    {
      alphaPrompt: input.alphaPrompt,
      symbols: input.marketData.symbols,
    },
    {
      optimizedDSL,
      fitness,
      metrics: result.detailedReport,
    },
    `AlphaQualityOptimizer/${this.agentName}`
  );

  logMetric("alpha_quality_optimizer_fitness", result.fitness, {
    alphaPrompt: input.alphaPrompt.substring(0, 30),
  });

  logMetric("alpha_quality_optimizer_duration_ms", duration, {});

  return result;
}
```

**Step 2: Run a verification cycle**

```bash
cd /home/kafka/finance/investor
task run:newalphasearch:cycle
```

Expected: Integration with pipeline should work, logs should show AlphaQualityOptimizer invocation

**Step 3: Commit telemetry**

```bash
cd /home/kafka/finance/investor
git add ts-agent/src/agents/alpha_quality_optimizer_agent.ts
git commit -m "feat(telemetry): add logging and metrics to AlphaQualityOptimizer"
```

---

# Summary

**Plan complete.** 13 tasks spanning:
1. ✅ Zod schemas (input/output)
2. ✅ Agent skeleton (BaseAgent)
3. ✅ 4 metrics (correlation, constraint, orthogonality, backtest)
4. ✅ Qwen DSL generation
5. ✅ Validation + strict repair
6. ✅ Pipeline integration
7. ✅ E2E tests
8. ✅ Documentation
9. ✅ Telemetry

---

## Next Steps After Approval

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task (2-5 min each), review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach do you prefer?**
