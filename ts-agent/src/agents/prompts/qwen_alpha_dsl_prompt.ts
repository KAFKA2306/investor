import { core } from "../../system/app_runtime_core.ts";
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
2. Use only these allowed operations: Rank(), Scale(), Abs(), Sign(), Log(), Mean(), Std(), Ref(), Corr()
3. Reference only known factors with '$' prefix: $momentum, $value, $size, $volatility, $quality, $growth, $dividend, $close, $open, $high, $low, $volume
4. Example valid format: "alpha = Rank($momentum) * -1 + Rank($value) * 0.5"
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
  const aiConfig = core.config.providers.ai;
  const apiKey = core.getProviderCredential("ai", "apiKey", "OPENAI_API_KEY");
  const baseUrl = core.getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
  const model = core.getEnv("OPENAI_MODEL", "gemini-3-flash");

  logger.info(`[Qwen] Generating DSL with model: ${model} via ${baseUrl}`);
  logger.debug(`[Qwen] Prompt (first 200 chars): ${prompt.slice(0, 200)}...`);

  if (!apiKey) {
    logger.warn("[Qwen] No API key found. Falling back to default mock factor.");
    return "alpha = Rank($volatility) * -1 + Rank($momentum) * 0.3";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[Qwen] API error: ${response.status} ${errorText}`);
    throw new Error(`Qwen API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  const content = data.choices[0]?.message?.content?.trim() || "";

  // Clean up code blocks if LLM included them
  const cleaned = content.replace(/```[a-z]*\n?/g, "").replace(/\n?```/g, "").trim();

  return cleaned;
}
