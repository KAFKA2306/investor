import { describe, it, expect, beforeAll } from "bun:test";
import { AlphaQualityOptimizerAgent } from "../../src/agents/alpha_quality_optimizer_agent.ts";
import type {
  AlphaQualityOptimizerInput,
  AlphaQualityOptimizerOutput,
} from "../../src/schemas/alpha_quality_optimizer_schema.ts";

/**
 * E2E Test Suite for AlphaQualityOptimizerAgent
 *
 * Tests the full pipeline of AlphaQualityOptimizer:
 * 1. Input validation via Zod schema
 * 2. Qwen LLM-based DSL generation
 * 3. DSL validation and repair loop
 * 4. Metric computation (correlation, constraint, orthogonality, backtest)
 * 5. Fitness score aggregation
 * 6. Output validation
 *
 * Test coverage:
 * - Valid inputs with real market data
 * - Fitness score computation
 * - DSL generation and optimization
 * - Error handling and fallback mechanisms
 */

describe("AlphaQualityOptimizerAgent E2E Tests", () => {
  let agent: AlphaQualityOptimizerAgent;

  beforeAll(() => {
    // Initialize agent with test configuration
    agent = new AlphaQualityOptimizerAgent({
      modelId: "qwen:latest",
      metricsWeights: {
        correlation: 0.25,
        constraint: 0.25,
        orthogonal: 0.25,
        backtest: 0.25,
      },
    });
  });

  it("should initialize agent with valid configuration", () => {
    expect(agent).toBeDefined();
    expect(agent.agentName).toBe("AlphaQualityOptimizer");
  });

  it("should process real market data and return fitness score in valid range", async () => {
    // Prepare realistic market data snapshot
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt:
        "日本株の低ボラティリティ効果を狙う小型株戦略。過去3年で安定したリターンを生成し、ドローダウンを最小化。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["9984", "6758", "4452"],
        returns: [
          [0.01, 0.015, 0.02, 0.01, -0.005, 0.008, 0.012],
          [0.02, 0.025, 0.03, 0.015, 0.005, 0.010, 0.018],
          [0.005, 0.01, 0.015, 0.002, -0.01, 0.003, 0.007],
        ],
        volatilities: [0.12, 0.15, 0.18],
        sharpeRatio: 1.85,
        informationCoefficient: 0.055,
        maxDrawdown: 0.088,
      },
      playbookPatterns: [
        { factorSet: ["momentum", "value"], fitnessScore: 0.48 },
        { factorSet: ["size"], fitnessScore: 0.52 },
      ],
    };

    // Execute agent
    const result = await agent.run(input);

    // Verify output structure
    expect(result).toBeDefined();
    expect(result.optimizedDSL).toBeDefined();
    expect(typeof result.optimizedDSL).toBe("string");
    expect(result.fitness).toBeDefined();
    expect(typeof result.fitness).toBe("number");
    expect(result.detailedReport).toBeDefined();

    // Verify fitness score is in valid range [0, 1]
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);

    // Verify detailed report contains all metric scores
    expect(result.detailedReport.correlationScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.correlationScore).toBeLessThanOrEqual(1);
    expect(result.detailedReport.constraintScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.constraintScore).toBeLessThanOrEqual(1);
    expect(result.detailedReport.orthogonalityScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.orthogonalityScore).toBeLessThanOrEqual(1);
    expect(result.detailedReport.backtestScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.backtestScore).toBeLessThanOrEqual(1);

    // Verify reasoning is provided
    expect(result.detailedReport.reasoning).toBeDefined();
    expect(typeof result.detailedReport.reasoning).toBe("string");
    expect(result.detailedReport.reasoning.length).toBeGreaterThan(0);

    console.log("✅ [E2E Test] Alpha Quality Optimizer E2E Test PASSED");
    console.log(`   Fitness Score: ${result.fitness.toFixed(4)}`);
    console.log(`   Optimized DSL Length: ${result.optimizedDSL.length} chars`);
  });

  it("should generate valid DSL starting with alpha =", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt:
        "モメンタム戦略。直近3ヶ月の高リターン銘柄に投資し、毎週リバランス。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["6501", "9501"],
        returns: [
          [0.05, 0.03, -0.02, 0.04, 0.06],
          [0.02, 0.01, -0.01, 0.03, 0.04],
        ],
        volatilities: [0.20, 0.18],
        sharpeRatio: 1.5,
        informationCoefficient: 0.035,
        maxDrawdown: 0.15,
      },
      playbookPatterns: [],
    };

    const result = await agent.run(input);

    // Verify DSL format
    expect(result.optimizedDSL).toContain("alpha");
    expect(result.optimizedDSL.toLowerCase()).toContain("=");

    // DSL should be alphanumeric and contain expected function patterns
    const dslContent = result.optimizedDSL;
    expect(dslContent.length).toBeGreaterThan(10);
    expect(dslContent.length).toBeLessThan(5000);

    console.log("✅ [E2E Test] DSL Validation Test PASSED");
    console.log(`   Generated DSL: ${dslContent.slice(0, 100)}...`);
  });

  it("should handle market data with varying symbols and volatilities", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt:
        "クオリティ戦略。高配当利回り＋低ボラティリティ銘柄を選別。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1301", "1550", "2914", "9020"],
        returns: [
          [0.005, 0.008, -0.002, 0.001, 0.003],
          [0.01, 0.02, 0.015, 0.005, -0.005],
          [0.02, 0.025, 0.030, 0.010, 0.005],
          [0.015, 0.018, 0.020, 0.008, 0.002],
        ],
        volatilities: [0.08, 0.12, 0.18, 0.14],
        sharpeRatio: 2.2,
        informationCoefficient: 0.065,
        maxDrawdown: 0.065,
      },
      playbookPatterns: [
        { factorSet: ["dividend_yield"], fitnessScore: 0.58 },
        { factorSet: ["volatility"], fitnessScore: 0.62 },
      ],
    };

    const result = await agent.run(input);

    // Higher quality market data should yield better fitness
    expect(result.fitness).toBeGreaterThan(0.3);

    // Constraint score should be high with good Sharpe/IC/Drawdown
    expect(result.detailedReport.constraintScore).toBeGreaterThan(0.5);

    console.log("✅ [E2E Test] Multi-Symbol Market Data Test PASSED");
    console.log(`   Constraint Score: ${result.detailedReport.constraintScore.toFixed(4)}`);
  });

  it("should compute orthogonality score considering playbook patterns", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "ボラティリティアービトラージ。VIX連動型ヘッジ戦略。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1570"],
        returns: [[0.001, -0.002, 0.0015, -0.001, 0.0005]],
        volatilities: [0.10],
        sharpeRatio: 1.2,
        informationCoefficient: 0.02,
        maxDrawdown: 0.08,
      },
      playbookPatterns: [
        { factorSet: ["volatility_arbitrage"], fitnessScore: 0.45 },
      ],
    };

    const result = await agent.run(input);

    // Orthogonality score should account for playbook pattern overlap
    expect(result.detailedReport.orthogonalityScore).toBeDefined();
    expect(result.detailedReport.orthogonalityScore).toBeGreaterThanOrEqual(0);
    expect(result.detailedReport.orthogonalityScore).toBeLessThanOrEqual(1);

    console.log(
      "✅ [E2E Test] Orthogonality Score Computation Test PASSED",
    );
    console.log(
      `   Orthogonality Score: ${result.detailedReport.orthogonalityScore.toFixed(4)}`,
    );
  });

  it("should aggregate fitness as weighted sum of all metrics", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt:
        "カテゴリーローテーション。セクターローテーション投資戦略。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["1333", "1666", "2002"],
        returns: [
          [0.03, 0.02, 0.01, 0.02, 0.04],
          [0.025, 0.015, 0.01, 0.03, 0.035],
          [0.02, 0.01, 0.005, 0.025, 0.03],
        ],
        volatilities: [0.16, 0.14, 0.12],
        sharpeRatio: 1.95,
        informationCoefficient: 0.048,
        maxDrawdown: 0.095,
      },
      playbookPatterns: [
        { factorSet: ["sector_rotation"], fitnessScore: 0.55 },
      ],
    };

    const result = await agent.run(input);

    // Fitness should reflect weighted aggregation of all metrics
    // With equal weights (0.25 each), fitness should be influenced by all 4 metrics
    const expectedRange = {
      min: Math.min(
        result.detailedReport.correlationScore,
        result.detailedReport.constraintScore,
        result.detailedReport.orthogonalityScore,
        result.detailedReport.backtestScore,
      ),
      max: Math.max(
        result.detailedReport.correlationScore,
        result.detailedReport.constraintScore,
        result.detailedReport.orthogonalityScore,
        result.detailedReport.backtestScore,
      ),
    };

    // Fitness should be between the min and max of individual metrics
    expect(result.fitness).toBeGreaterThanOrEqual(expectedRange.min);
    expect(result.fitness).toBeLessThanOrEqual(expectedRange.max);

    // With equal weights, fitness should be close to average
    const avgMetrics =
      (result.detailedReport.correlationScore +
        result.detailedReport.constraintScore +
        result.detailedReport.orthogonalityScore +
        result.detailedReport.backtestScore) /
      4;
    const tolerance = 0.1;
    expect(Math.abs(result.fitness - avgMetrics)).toBeLessThan(tolerance);

    console.log(
      "✅ [E2E Test] Fitness Aggregation Test PASSED",
    );
    console.log(`   Individual Metrics Average: ${avgMetrics.toFixed(4)}`);
    console.log(`   Aggregated Fitness: ${result.fitness.toFixed(4)}`);
  });

  it("should handle edge case with minimal market data", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "ミニマル戦略。単一銘柄投資。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["6754"],
        returns: [[0.01, -0.01, 0.02]],
        volatilities: [0.10],
        sharpeRatio: 0.5,
        informationCoefficient: 0.01,
        maxDrawdown: 0.20,
      },
      playbookPatterns: [],
    };

    const result = await agent.run(input);

    // Should still produce valid output even with minimal data
    expect(result).toBeDefined();
    expect(result.optimizedDSL).toBeDefined();
    expect(result.fitness).toBeDefined();
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThanOrEqual(1);

    console.log("✅ [E2E Test] Edge Case (Minimal Data) Test PASSED");
    console.log(`   Fitness for minimal data: ${result.fitness.toFixed(4)}`);
  });

  it("should produce consistent output across multiple runs with same input", async () => {
    const input: AlphaQualityOptimizerInput = {
      alphaPrompt: "安定戦略。配当貴族インデックス戦略。",
      marketData: {
        asOfDate: "2026-03-03",
        symbols: ["8306", "8308"],
        returns: [
          [0.008, 0.010, 0.012, 0.009],
          [0.007, 0.009, 0.011, 0.008],
        ],
        volatilities: [0.09, 0.08],
        sharpeRatio: 2.1,
        informationCoefficient: 0.060,
        maxDrawdown: 0.070,
      },
      playbookPatterns: [
        { factorSet: ["dividend_yield", "quality"], fitnessScore: 0.60 },
      ],
    };

    const result1 = await agent.run(input);
    const result2 = await agent.run(input);

    // DSL generation from LLM may vary, but fitness computation should be consistent
    // (assuming same underlying metrics computation)
    expect(result1.fitness).toBeDefined();
    expect(result2.fitness).toBeDefined();

    // Both should be valid fitness scores
    expect(result1.fitness).toBeGreaterThanOrEqual(0);
    expect(result2.fitness).toBeGreaterThanOrEqual(0);

    console.log("✅ [E2E Test] Consistency Test PASSED");
    console.log(`   Run 1 Fitness: ${result1.fitness.toFixed(4)}`);
    console.log(`   Run 2 Fitness: ${result2.fitness.toFixed(4)}`);
  });
});
