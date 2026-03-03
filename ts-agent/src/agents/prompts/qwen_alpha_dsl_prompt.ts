import { logger } from "../../utils/logger.ts";

/**
 * buildQwenAlphaDSLPrompt
 *
 * Constructs a comprehensive prompt for Qwen LLM to generate alpha DSL
 * based on investment theme, market symbols, and volatility context.
 *
 * Args:
 *   alphaPrompt: Investment theme/strategy description (e.g., "日本株の低ボラティリティ効果")
 *   symbols: Array of stock symbols to consider (e.g., ["9984", "6758"])
 *   avgVolatility: Average market volatility (0.0-1.0 scale) for context
 *
 * Returns:
 *   String: Full prompt template ready for Qwen LLM consumption
 *
 * Market Condition Logic:
 *   - If avgVolatility > 0.15: "高ボラティリティ市場"
 *   - Otherwise: "低ボラティリティ市場"
 */
export function buildQwenAlphaDSLPrompt(
  alphaPrompt: string,
  symbols: string[],
  avgVolatility: number,
): string {
  const marketCondition =
    avgVolatility > 0.15 ? "高ボラティリティ市場" : "低ボラティリティ市場";
  const volatilityPercentage = (avgVolatility * 100).toFixed(1);

  const prompt = `You are an expert quantitative analyst specializing in alpha factor discovery for Japanese equities.

## Task
Generate a single-line alpha DSL (Domain-Specific Language) based on the following investment theme:

**Theme**: ${alphaPrompt}

## Context
- Universe: JP stock symbols ${symbols.join(", ")}
- Current Market Condition: ${marketCondition} (avg volatility: ${volatilityPercentage}%)
- Language: Japanese (for reasoning), English (for DSL syntax)

## Requirements
1. Output ONLY the alpha formula as a single line starting with "alpha = "
2. Use only these allowed operations: rank(), scale(), abs(), sign(), log()
3. Reference only known factors: momentum, value, size, volatility, quality, growth, dividend
4. Example valid format: "alpha = rank(momentum) * -1 + rank(value) * 0.5"
5. Do NOT include explanations, just the formula

## Output
alpha = `;

  return prompt;
}

/**
 * generateAlphaDSLWithQwen
 *
 * Calls Qwen LLM (via Ollama or similar endpoint) to generate alpha DSL
 * based on a constructed prompt.
 *
 * Args:
 *   prompt: Full prompt string (typically from buildQwenAlphaDSLPrompt)
 *   modelId: Qwen model identifier (default: "qwen:latest")
 *            Examples: "qwen:7b", "qwen:14b", "qwen:latest"
 *
 * Returns:
 *   Promise<string>: Generated DSL formula string starting with "alpha = "
 *
 * Implementation Notes:
 *   - Current version: Mock implementation returning placeholder DSL
 *   - Future version: Will integrate with Ollama HTTP endpoint
 *   - Endpoint: http://localhost:11434/api/generate
 *   - Timeout: 30 seconds recommended
 *   - Streaming: Optional (stream: false for simplicity)
 */
export async function generateAlphaDSLWithQwen(
  prompt: string,
  modelId: string = "qwen:latest",
): Promise<string> {
  logger.info(`[Qwen] Generating DSL with model: ${modelId}`);
  logger.debug(`[Qwen] Prompt (first 200 chars): ${prompt.slice(0, 200)}...`);

  // TODO: Implement actual Qwen/Ollama integration
  // const response = await fetch("http://localhost:11434/api/generate", {
  //   method: "POST",
  //   body: JSON.stringify({
  //     model: modelId,
  //     prompt: prompt,
  //     stream: false,
  //   }),
  //   timeout: 30000,
  // });
  //
  // if (!response.ok) {
  //   throw new Error(`Qwen API error: ${response.status} ${response.statusText}`);
  // }
  //
  // const data = await response.json();
  // return data.response.trim();

  // Current: Mock implementation
  logger.info("[Qwen] Using mock DSL generation (Ollama not available)");
  return "alpha = rank(volatility) * -1 + rank(momentum) * 0.3";
}
