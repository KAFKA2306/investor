import { z } from "zod";

/**
 * MarketSnapshotSchema
 * Represents a point-in-time market data snapshot for quality evaluation.
 * Includes price returns, volatilities, and aggregate performance metrics.
 */
export const MarketSnapshotSchema = z.object({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  symbols: z.array(z.string()).min(1, "At least one symbol required"),
  returns: z.array(z.array(z.number()), "Returns must be a 2D array"),
  volatilities: z
    .array(z.number().nonnegative("Volatility must be non-negative"))
    .min(1),
  sharpeRatio: z.number(),
  maxDrawdown: z
    .number()
    .min(0, "MaxDrawdown must be >= 0")
    .max(1, "MaxDrawdown must be <= 1"),
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

/**
 * PlaybookPatternSchema
 * Represents a historical playbook pattern with its fitness score.
 * factorSet contains the names of factors used in the pattern.
 * fitnessScore defaults to 0 if not provided.
 */
export const PlaybookPatternSchema = z.object({
  factorSet: z.array(z.string()).min(1, "At least one factor in the set"),
  fitnessScore: z
    .number()
    .min(0, "Fitness score must be >= 0")
    .max(1, "Fitness score must be <= 1")
    .default(0),
});

export type PlaybookPattern = z.infer<typeof PlaybookPatternSchema>;

/**
 * DetailedReportSchema
 * Breakdown of alpha quality across four dimensions plus reasoning text.
 * Each score is in [0, 1] range, and reasoning provides context.
 */
export const DetailedReportSchema = z.object({
  correlationScore: z
    .number()
    .min(0, "Correlation score must be >= 0")
    .max(1, "Correlation score must be <= 1"),
  constraintScore: z
    .number()
    .min(0, "Constraint score must be >= 0")
    .max(1, "Constraint score must be <= 1"),
  orthogonalityScore: z
    .number()
    .min(0, "Orthogonality score must be >= 0")
    .max(1, "Orthogonality score must be <= 1"),
  backtestScore: z
    .number()
    .min(0, "Backtest score must be >= 0")
    .max(1, "Backtest score must be <= 1"),
  reasoning: z.string().min(1, "Reasoning must be non-empty"),
});

export type DetailedReport = z.infer<typeof DetailedReportSchema>;

/**
 * AlphaQualityOptimizerInputSchema
 * Input to the AlphaQualityOptimizer agent.
 * alphaPrompt: LLM prompt describing the desired alpha factor
 * marketData: Current market snapshot for evaluation context
 * playbookPatterns: Optional historical patterns for context (defaults to empty array)
 */
export const AlphaQualityOptimizerInputSchema = z.object({
  alphaPrompt: z.string().min(1, "Alpha prompt must be non-empty"),
  marketData: MarketSnapshotSchema,
  playbookPatterns: z.array(PlaybookPatternSchema).default([]),
});

export type AlphaQualityOptimizerInput = z.infer<
  typeof AlphaQualityOptimizerInputSchema
>;

/**
 * AlphaQualityOptimizerOutputSchema
 * Output from the AlphaQualityOptimizer agent.
 * optimizedDSL: The refined alpha factor DSL string
 * fitness: Overall fitness score in [0, 1]
 * detailedReport: Breakdown of quality evaluation
 */
export const AlphaQualityOptimizerOutputSchema = z.object({
  optimizedDSL: z.string().min(1, "Optimized DSL must be non-empty"),
  fitness: z
    .number()
    .min(0, "Fitness must be >= 0")
    .max(1, "Fitness must be <= 1"),
  detailedReport: DetailedReportSchema,
});

export type AlphaQualityOptimizerOutput = z.infer<
  typeof AlphaQualityOptimizerOutputSchema
>;

/**
 * AlphaQualityOptimizerConfigSchema
 * Configuration for the AlphaQualityOptimizer agent.
 * modelId: LLM model identifier for DSL generation and optimization
 * metricsWeights: Weights for the four quality metrics (must sum close to 1.0)
 */
export const AlphaQualityOptimizerConfigSchema = z.object({
  modelId: z.string().min(1, "Model ID must be non-empty"),
  metricsWeights: z.object({
    correlation: z
      .number()
      .min(0, "Correlation weight must be >= 0")
      .max(1, "Correlation weight must be <= 1"),
    constraint: z
      .number()
      .min(0, "Constraint weight must be >= 0")
      .max(1, "Constraint weight must be <= 1"),
    orthogonal: z
      .number()
      .min(0, "Orthogonal weight must be >= 0")
      .max(1, "Orthogonal weight must be <= 1"),
    backtest: z
      .number()
      .min(0, "Backtest weight must be >= 0")
      .max(1, "Backtest weight must be <= 1"),
  }),
});

export type AlphaQualityOptimizerConfig = z.infer<
  typeof AlphaQualityOptimizerConfigSchema
>;
