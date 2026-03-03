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
      informationCoefficient: 0.05,
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
    const result = await agent.run(testInput);

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
    const result = await agent.run(testInput);

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
    const result = await agent.run(testInput);
    expect(result).toBeDefined();
  });

  it("should produce detailed report with all required metrics", async () => {
    const agent = new AlphaQualityOptimizerAgent(testConfig);
    const result = await agent.run(testInput);

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

    const result = await agent.run(inputWithoutPatterns);
    expect(result).toBeDefined();
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);
  });
});
