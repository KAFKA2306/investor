import {
  type AlphaQualityOptimizerConfig,
  AlphaQualityOptimizerConfigSchema,
  type AlphaQualityOptimizerInput,
  type AlphaQualityOptimizerOutput,
  AlphaQualityOptimizerOutputSchema,
} from "../schemas/alpha_quality_optimizer_schema.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logIO, logMetric } from "../system/telemetry_logger.ts";
import { logger } from "../utils/logger.ts";
import { computeBacktestScore } from "./metrics/backtest_scorer.ts";
import { computeConstraintScore } from "./metrics/constraint_scorer.ts";
import { computeCorrelationScore } from "./metrics/correlation_scorer.ts";
import {
  computeOrthogonalityScore,
  extractFactorsFromDSL,
} from "./metrics/orthogonality_scorer.ts";
import {
  buildQwenAlphaDSLPrompt,
  generateAlphaDSLWithQwen,
} from "./prompts/qwen_alpha_dsl_prompt.ts";
import { validateDSL } from "./validators/dsl_validator.ts";

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
   * 1. Build Qwen prompt with market context (volatility, symbols)
   * 2. Call Qwen LLM to generate optimized DSL
   * 2.5. STRICT VALIDATION: Validate DSL with repair loop (Never Fallback to Claude)
   *      - Rejects invalid functions/factors
   *      - Attempts simple repairs (e.g., "alpha =" prefix)
   *      - Throws error if unrepairable (fail fast, no API fallback)
   * 3. Extract factors from DSL
   * 4. Compute all 4 metrics:
   *    - Correlation Score: factor correlation with returns
   *    - Constraint Score: Sharpe and MaxDrawdown compliance
   *    - Orthogonality Score: uniqueness vs playbook patterns
   *    - Backtest Score: aggregate backtest quality
   * 5. Aggregate fitness as weighted sum of 4 metrics
   * 6. Return output with detailed report
   */
  async run(): Promise<void> {
    logger.info(`[${this.agentName}] Optimizer standing by...`);
  }

  async evaluate(
    input: AlphaQualityOptimizerInput,
  ): Promise<AlphaQualityOptimizerOutput> {
    const startTime = performance.now();

    logger.info(
      `[${this.agentName}] Starting optimization for prompt: "${input.alphaPrompt.slice(0, 50)}..."`,
    );

    // Log input telemetry
    logIO({
      stage: "alpha_quality_optimizer.evaluate",
      direction: "IN",
      name: "optimization_request",
      values: {
        alpha_prompt_length: input.alphaPrompt.length,
        symbol_count: input.marketData.symbols.length,
        playbook_patterns: input.playbookPatterns.length,
      },
    });

    // Step 1: Build Qwen prompt with market context
    const avgVolatility =
      input.marketData.volatilities.length > 0
        ? input.marketData.volatilities.reduce((a, b) => a + b, 0) /
          input.marketData.volatilities.length
        : 0;
    const qwenPrompt = buildQwenAlphaDSLPrompt(
      input.alphaPrompt,
      input.marketData.symbols,
      avgVolatility,
    );
    logger.debug(
      `[${this.agentName}] Built Qwen prompt with ${input.marketData.symbols.length} symbols and ${(avgVolatility * 100).toFixed(1)}% avg volatility`,
    );

    // Step 2: Generate optimized DSL using Qwen LLM
    let optimizedDSL = await generateAlphaDSLWithQwen(
      qwenPrompt,
      this.config.modelId,
    );
    logger.info(`[${this.agentName}] Generated optimized DSL: ${optimizedDSL}`);

    // Step 2.5: CRITICAL VALIDATION - Strict DSL validation with repair (Never Fallback)
    const validation = validateDSL(optimizedDSL);
    if (!validation.valid && !validation.repaired) {
      logger.error(
        `[${this.agentName}] DSL validation failed and unrepairable:`,
        {
          originalDSL: optimizedDSL,
          errors: validation.errors.join(", "),
        },
      );
      // NEVER fallback to Claude API - throw error and fail fast
      throw new Error(
        `Invalid DSL from Qwen (unrepairable): ${validation.errors.join("; ")}`,
      );
    }

    if (validation.repaired) {
      logger.warn(`[${this.agentName}] DSL auto-repaired:`, {
        original: optimizedDSL,
        repaired: validation.repaired,
      });
      optimizedDSL = validation.repaired;
    } else {
      logger.debug(
        `[${this.agentName}] DSL validation passed (no repairs needed)`,
      );
    }

    // Step 3: Extract factors from DSL
    const dslFactors = extractFactorsFromDSL(optimizedDSL);
    logger.debug(
      `[${this.agentName}] Extracted factors from DSL: ${dslFactors.join(", ")}`,
    );

    // Step 4: Compute all 4 metrics

    // 4.1 Correlation Score: measure correlation between factors and returns
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

    const constraintScore = computeConstraintScore({
      sharpeRatio: input.marketData.sharpeRatio,
      maxDrawdown: input.marketData.maxDrawdown,
    });
    logger.debug(
      `[${this.agentName}] Constraint Score: ${constraintScore.toFixed(4)}`,
    );

    // 4.3 Orthogonality Score: measure uniqueness vs historical patterns
    const orthogonalityScore = computeOrthogonalityScore(
      dslFactors,
      input.playbookPatterns,
    );
    logger.debug(
      `[${this.agentName}] Orthogonality Score: ${orthogonalityScore.toFixed(4)}`,
    );

    // 4.4 Backtest Score: evaluate Sharpe ratio
    const backtestScore = computeBacktestScore(input.marketData.sharpeRatio);
    logger.debug(
      `[${this.agentName}] Backtest Score: ${backtestScore.toFixed(4)}`,
    );

    // Step 5: Aggregate fitness as weighted sum of 4 metrics
    const fitness =
      this.config.metricsWeights.correlation * correlationScore +
      this.config.metricsWeights.constraint * constraintScore +
      this.config.metricsWeights.orthogonal * orthogonalityScore +
      this.config.metricsWeights.backtest * backtestScore;

    // Step 6: Construct and validate output
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
    const outputValidation =
      AlphaQualityOptimizerOutputSchema.safeParse(output);
    if (!outputValidation.success) {
      logger.error(
        `[${this.agentName}] Output validation failed: ${outputValidation.error.message}`,
      );
      throw new Error("Failed to generate valid output");
    }

    // Log output telemetry
    logIO({
      stage: "alpha_quality_optimizer.evaluate",
      direction: "OUT",
      name: "optimization_result",
      values: {
        fitness: Number(output.fitness.toFixed(4)),
        optimized_dsl_length: output.optimizedDSL.length,
        factors_count: dslFactors.length,
      },
    });

    // Log detailed metrics
    logMetric({
      stage: "alpha_quality_optimizer.evaluate",
      name: "fitness_scores",
      values: {
        correlation: Number(correlationScore.toFixed(4)),
        constraint: Number(constraintScore.toFixed(4)),
        orthogonal: Number(orthogonalityScore.toFixed(4)),
        backtest: Number(backtestScore.toFixed(4)),
        fitness: Number(output.fitness.toFixed(4)),
      },
    });

    // Log execution duration
    const duration = performance.now() - startTime;
    logMetric({
      stage: "alpha_quality_optimizer.evaluate",
      name: "execution_duration",
      values: {
        ms: Number(duration.toFixed(2)),
      },
    });

    logger.info(
      `[${this.agentName}] Optimization complete. Fitness score: ${output.fitness.toFixed(4)} (${duration.toFixed(0)}ms)`,
    );

    return outputValidation.data;
  }
}
