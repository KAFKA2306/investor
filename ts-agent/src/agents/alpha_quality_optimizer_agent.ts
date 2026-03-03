import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";
import {
  AlphaQualityOptimizerConfigSchema,
  AlphaQualityOptimizerOutputSchema,
  type AlphaQualityOptimizerConfig,
  type AlphaQualityOptimizerInput,
  type AlphaQualityOptimizerOutput,
} from "../schemas/alpha_quality_optimizer_schema.ts";
import { computeCorrelationScore } from "./metrics/correlation_scorer.ts";
import { computeConstraintScore } from "./metrics/constraint_scorer.ts";
import {
  computeOrthogonalityScore,
  extractFactorsFromDSL,
} from "./metrics/orthogonality_scorer.ts";
import { computeBacktestScore } from "./metrics/backtest_scorer.ts";

/**
 * AlphaQualityOptimizerAgent
 * Evaluates and optimizes alpha factors based on quality metrics.
 *
 * Responsibilities:
 * - Validate alpha factor quality across multiple dimensions
 * - Calculate composite fitness scores
 * - Provide detailed optimization reports
 * - Generate optimized DSL representations
 *
 * This agent extends BaseAgent and follows the standard pattern for
 * agent initialization and execution.
 */
export class AlphaQualityOptimizerAgent extends BaseAgent {
  readonly agentName = "AlphaQualityOptimizer";
  private config: AlphaQualityOptimizerConfig;

  constructor(config: AlphaQualityOptimizerConfig) {
    super();
    // Validate config against schema
    const validation = AlphaQualityOptimizerConfigSchema.safeParse(config);
    if (!validation.success) {
      logger.error(
        `[${this.agentName}] Invalid configuration: ${validation.error.message}`,
      );
      throw new Error(`Invalid AlphaQualityOptimizer configuration`);
    }
    this.config = validation.data;
    logger.info(
      `[${this.agentName}] initialized with modelId: ${this.config.modelId}`,
    );
  }

  /**
   * Main execution method for alpha quality optimization.
   *
   * Args:
   *   input: AlphaQualityOptimizerInput containing alphaPrompt, marketData, and playbookPatterns
   *
   * Returns:
   *   AlphaQualityOptimizerOutput with optimized DSL, fitness score, and detailed report
   *
   * Implementation flow:
   * 1. Generate optimized DSL (placeholder for now)
   * 2. Extract factors from DSL
   * 3. Compute all 4 metrics:
   *    - Correlation Score: factor correlation with returns
   *    - Constraint Score: Sharpe, IC, MaxDrawdown compliance
   *    - Orthogonality Score: uniqueness vs playbook patterns
   *    - Backtest Score: aggregate backtest quality
   * 4. Aggregate fitness as weighted sum of 4 metrics
   * 5. Return output with detailed report
   */
  async run(
    input: AlphaQualityOptimizerInput,
  ): Promise<AlphaQualityOptimizerOutput> {
    logger.info(
      `[${this.agentName}] Starting optimization for prompt: "${input.alphaPrompt.slice(0, 50)}..."`,
    );

    // Step 1: DSL generation (placeholder - will be implemented in Task 8)
    const optimizedDSL = "alpha = rank(volatility) * -1";

    // Step 2: Extract factors from DSL
    const dslFactors = extractFactorsFromDSL(optimizedDSL);
    logger.debug(
      `[${this.agentName}] Extracted factors from DSL: ${dslFactors.join(", ")}`,
    );

    // Step 3: Compute all 4 metrics

    // 3.1 Correlation Score: measure correlation between factors and returns
    const returnsArray = input.marketData.returns[0] || [];
    // TODO: In Task 8, replace with actual factor values extracted from market data
    const mockFactorValues = [returnsArray];
    const correlationScore = computeCorrelationScore(
      mockFactorValues,
      returnsArray,
    );
    logger.debug(
      `[${this.agentName}] Correlation Score: ${correlationScore.toFixed(4)}`,
    );

    // 3.2 Constraint Score: evaluate Sharpe, IC, and MaxDrawdown thresholds
    const constraintScore = computeConstraintScore({
      sharpeRatio: input.marketData.sharpeRatio,
      informationCoefficient: input.marketData.informationCoefficient,
      maxDrawdown: input.marketData.maxDrawdown,
    });
    logger.debug(
      `[${this.agentName}] Constraint Score: ${constraintScore.toFixed(4)}`,
    );

    // 3.3 Orthogonality Score: measure uniqueness vs historical patterns
    const orthogonalityScore = computeOrthogonalityScore(
      dslFactors,
      input.playbookPatterns,
    );
    logger.debug(
      `[${this.agentName}] Orthogonality Score: ${orthogonalityScore.toFixed(4)}`,
    );

    // 3.4 Backtest Score: aggregate Sharpe and IC into single quality metric
    const backtestScore = computeBacktestScore(
      input.marketData.sharpeRatio,
      input.marketData.informationCoefficient,
    );
    logger.debug(
      `[${this.agentName}] Backtest Score: ${backtestScore.toFixed(4)}`,
    );

    // Step 4: Aggregate fitness as weighted sum of 4 metrics
    const fitness =
      this.config.metricsWeights.correlation * correlationScore +
      this.config.metricsWeights.constraint * constraintScore +
      this.config.metricsWeights.orthogonal * orthogonalityScore +
      this.config.metricsWeights.backtest * backtestScore;

    // Step 5: Construct and validate output
    const output: AlphaQualityOptimizerOutput = {
      optimizedDSL,
      fitness,
      detailedReport: {
        correlationScore,
        constraintScore,
        orthogonalityScore,
        backtestScore,
        reasoning: `Correlation: ${correlationScore.toFixed(2)}, Constraint: ${constraintScore.toFixed(2)}, Orthogonal: ${orthogonalityScore.toFixed(2)}, Backtest: ${backtestScore.toFixed(2)}. Fitness aggregates all four metrics using weights: correlation=${this.config.metricsWeights.correlation}, constraint=${this.config.metricsWeights.constraint}, orthogonal=${this.config.metricsWeights.orthogonal}, backtest=${this.config.metricsWeights.backtest}.`,
      },
    };

    // Validate output against schema before returning
    const validation = AlphaQualityOptimizerOutputSchema.safeParse(output);
    if (!validation.success) {
      logger.error(
        `[${this.agentName}] Output validation failed: ${validation.error.message}`,
      );
      throw new Error("Failed to generate valid output");
    }

    logger.info(
      `[${this.agentName}] Optimization complete. Fitness score: ${output.fitness.toFixed(4)}`,
    );

    return validation.data;
  }
}
