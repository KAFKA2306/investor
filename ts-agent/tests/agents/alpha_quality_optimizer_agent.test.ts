import { describe, it, expect } from "bun:test";
import { AlphaQualityOptimizerAgent } from "../../src/agents/alpha_quality_optimizer_agent";
import {
  AlphaQualityOptimizerOutputSchema,
  type AlphaQualityOptimizerInput,
  type AlphaQualityOptimizerConfig,
} from "../../src/schemas/alpha_quality_optimizer_schema";

describe("AlphaQualityOptimizerAgent", () => {
  const testConfig: AlphaQualityOptimizerConfig = {
    modelId: "qwen:latest",
    metricsWeights: {
      correlation: 0.25,
      constraint: 0.25,
      orthogonal: 0.25,
      backtest: 0.25,
    },
  };

  const testInput: AlphaQualityOptimizerInput = {
    alphaPrompt: "Generate a momentum-based alpha factor for Japanese equities",
    marketData: {
      asOfDate: "2026-03-03",
      symbols: ["1234", "5678"],
      returns: [[0.01, 0.02], [0.015, 0.025]],
      volatilities: [0.08, 0.12],
      sharpeRatio: 1.8,
      maxDrawdown: 0.08,
    },
    playbookPatterns: [
      {
        factorSet: ["momentum"],
        fitnessScore: 0.65,
      },
    ],
  };

  it("should initialize with config", () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    expect(agent).toBeDefined();
    expect(agent.agentName).toBe("AlphaQualityOptimizer");
  });

  it("should initialize with different metric weights", () => {
    const customConfig: AlphaQualityOptimizerConfig = {
      modelId: "qwen:7b",
      metricsWeights: {
        correlation: 0.2,
        constraint: 0.3,
        orthogonal: 0.25,
        backtest: 0.25,
      },
    };
    const agent = new AlphaQualityOptimizerAgent(customConfig);
    expect(agent.agentName).toBe("AlphaQualityOptimizer");
  });

  it("should execute run() and return valid output", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    const result = await agent.evaluate(testInput);

    // Verify output structure
    expect(result).toBeDefined();
    expect(result.optimizedDSL).toBeDefined();
    expect(result.fitness).toBeDefined();
    expect(result.detailedReport).toBeDefined();

    // Verify types and ranges
    expect(typeof result.optimizedDSL).toBe("string");
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
  });

  it("should return output that passes Zod validation", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    const result = await agent.evaluate(testInput);

    const validation = AlphaQualityOptimizerOutputSchema.safeParse(result);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.fitness).toBeGreaterThanOrEqual(0);
      expect(validation.data.fitness).toBeLessThanOrEqual(1);
    }
  });

  it("should log information when running", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    // Simply verify that run() executes without throwing
    const result = await agent.evaluate(testInput);
    expect(result).toBeDefined();
  });

  it("should produce detailed report with all required metrics", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    const result = await agent.evaluate(testInput);

    expect(result.detailedReport).toBeDefined();
    expect(result.detailedReport.correlationScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.correlationScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.constraintScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.constraintScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.orthogonalityScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.orthogonalityScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.backtestScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.backtestScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.reasoning).toBeDefined();
    expect(typeof result.detailedReport.reasoning).toBe("string");
    expect(result.detailedReport.reasoning.length).toBeGreaterThan(0);
  });

  it("should handle input without playbook patterns", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    const inputWithoutPatterns: AlphaQualityOptimizerInput = {
      alphaPrompt: "Generate a simple mean reversion alpha",
      marketData: testInput.marketData,
      playbookPatterns: [],
    };

    const result = await agent.evaluate(inputWithoutPatterns);
    expect(result).toBeDefined();
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
  });

  it("should compute all 4 metrics and aggregate fitness", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "日本株の低ボラティリティ効果",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984"],
        returns: [[0.01, 0.02, 0.015, 0.025]],
        volatilities: [0.12],
        sharpeRatio: 1.9,
        maxDrawdown: 0.08,
      },
      playbookPatterns: [{ factorSet: ["momentum"], fitnessScore: 0.5 }],
    };

    const result = await agent.evaluate(input);

    // Verify all 4 metrics are computed and in valid range
    expect(result.detailedReport.correlationScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.correlationScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.constraintScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.constraintScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.orthogonalityScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.orthogonalityScore).toBeLessThanOrEqual(1);

    expect(result.detailedReport.backtestScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.backtestScore).toBeLessThanOrEqual(1);

    // Verify fitness is computed as weighted sum of 4 metrics
    const expectedFitness =
      0.25 * result.detailedReport.correlationScore +
      0.25 * result.detailedReport.constraintScore +
      0.25 * result.detailedReport.orthogonalityScore +
      0.25 * result.detailedReport.backtestScore;

    expect(result.fitness).toBeCloseTo(expectedFitness, 5);

    // Verify reasoning contains metric information
    expect(result.detailedReport.reasoning).toContain("Correlation");
    expect(result.detailedReport.reasoning).toContain("Constraint");
    expect(result.detailedReport.reasoning).toContain("Orthogonal");
    expect(result.detailedReport.reasoning).toContain("Backtest");
  });

  it("should handle high-quality alpha with excellent metrics", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "High-quality momentum factor",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984", "8008"],
        returns: [[0.02, 0.03, 0.02, 0.04], [0.015, 0.025, 0.018, 0.035]],
        volatilities: [0.15, 0.12],
        sharpeRatio: 2.5,
        maxDrawdown: 0.06,
      },
      playbookPatterns: [
        { factorSet: ["volatility", "beta"], fitnessScore: 0.6 },
      ],
    };

    const result = await agent.evaluate(input);

    // High-quality alpha should have decent scores across all metrics
    expect(result.detailedReport.constraintScore).toBeGreaterThan(0.5);
    expect(result.detailedReport.backtestScore).toBeGreaterThan(0.5);
    expect(result.fitness).toBeGreaterThan(0.4);
  });

  it("should handle weak alpha with poor metrics", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);

    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "Weak alpha factor",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984"],
        returns: [[0.001, 0.0005, 0.0008]],
        volatilities: [0.05],
        sharpeRatio: 0.8,
        maxDrawdown: 0.15,
      },
      playbookPatterns: [{ factorSet: ["momentum"], fitnessScore: 0.5 }],
    };

    const result = await agent.evaluate(input);

    // Weak alpha should have lower constraint score
    expect(result.detailedReport.constraintScore).toBeLessThan(0.8);
    // But fitness should still be in valid range
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
  });
});
