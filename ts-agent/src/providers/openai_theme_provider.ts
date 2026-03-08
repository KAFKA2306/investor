import { core } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

type ThemeProposalInput = {
  missionContext: string;
  marketContext: string;
  existingThemes: string[];
  forbiddenThemes: string[];
  recentSuccesses: string[];
  recentFailures: string[];
  userIntent?: string;
  inputChannel?: string;
};

export type ThemeProposal = {
  theme: string;
  hypothesis: string;
  featureSignature: string[];
  noveltyRationale: string;
  ideaHashHint: string;
  model: string;
  source: "OPENAI" | "FALLBACK";
};

const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_API_STYLE = "auto";

const extractOutputText = (responseJson: unknown): string => {
  if (!responseJson || typeof responseJson !== "object") return "";
  const record = responseJson as Record<string, unknown>;
  const top = record.output_text;
  if (typeof top === "string" && top.trim().length > 0) {
    return top;
  }
  const output = record.output;
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }
  return "";
};

const extractChatCompletionsText = (responseJson: unknown): string => {
  if (!responseJson || typeof responseJson !== "object") return "";
  const record = responseJson as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const text = (part as Record<string, unknown>).text;
    if (typeof text === "string" && text.trim().length > 0) {
      parts.push(text);
    }
  }
  return parts.join("").trim();
};

const normalizeFeatureSignature = (items: unknown): string[] => {
  if (!Array.isArray(items)) {
    throw new Error("normalizeFeatureSignature: items must be an array");
  }
  const result = items
    .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
    .filter((x): x is string => x.length > 0)
    .slice(0, 8);

  if (result.length === 0) {
    throw new Error("normalizeFeatureSignature: No valid features found");
  }
  return result;
};

const extractJsonObjectText = (text: string): string => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("OpenAI response did not contain a JSON object");
  }
  return text.slice(start, end + 1);
};

export class OpenAIThemeProvider {
  private readonly apiKey: string;
  private readonly model =
    core.getEnv("OPENAI_MODEL") ||
    core.config.providers.ai.model ||
    DEFAULT_MODEL;
  private readonly baseUrl = core.getEnv("OPENAI_BASE_URL") || DEFAULT_BASE_URL;
  private readonly apiStyle =
    core.getEnv("OPENAI_API_STYLE") || DEFAULT_API_STYLE;

  constructor() {
    this.apiKey = core.getProviderCredential("ai", "apiKey", "OPENAI_API_KEY");
    logger.info(
      `🤖 [OpenAIThemeProvider] Initialized with model: ${this.model}`,
    );
    logger.info(
      `🔌 [OpenAIThemeProvider] API style: ${this.resolveApiStyle()}`,
    );
    logger.info(
      `🔑 [OpenAIThemeProvider] API Key present: ${Boolean(this.apiKey)}`,
    );
  }

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  private resolveApiStyle(): "responses" | "chat_completions" {
    if (this.apiStyle === "responses") {
      return "responses";
    }
    if (this.apiStyle === "chat_completions") {
      return "chat_completions";
    }
    return this.baseUrl.includes("api.openai.com")
      ? "responses"
      : "chat_completions";
  }

  public async propose(input: ThemeProposalInput): Promise<ThemeProposal> {
    if (!this.isEnabled()) {
      throw new Error(
        "OpenAIThemeProvider is disabled: OPENAI_API_KEY is missing.",
      );
    }

    const isRiskOff = input.marketContext.includes("RISK_OFF");
    const systemPrompt = [
      "You are an autonomous quant alpha idea generator specializing in Japanese equities.",
      "You receive live hedge fund leverage signals from OFR SEC Form PF data.",
      "Leverage regime rules:",
      "- If the market context contains RISK_OFF or DELEVERAGING, you MUST include 'macro_leverage_trend' in featureSignature.",
      "- If the market context contains RISK_ON, prefer momentum and growth features; macro_leverage_trend is optional.",
      "- Always generate hypotheses that are falsifiable and grounded in the available feature columns.",
      "Return only valid JSON matching the requested schema. No prose, no markdown.",
    ].join("\n");
    const userPrompt = [
      // OFR macro context first so the LLM reads regime signals before anything else
      `[Live Macro Context - OFR SEC Form PF]\n${input.marketContext}`,
      "",
      `[Task] Generate exactly one novel alpha exploration theme for Japanese equities.`,
      `Current risk mode: ${isRiskOff ? "RISK_OFF — emphasize reversal, defensive, and low-beta signals" : "RISK_ON — momentum and growth signals preferred"}`,
      `Mission: ${input.missionContext}`,
      `User Intent: ${input.userIntent?.trim() || "none"}`,
      `Existing Themes (avoid duplication): ${input.existingThemes.join(", ") || "none"}`,
      `Forbidden Themes (never use): ${input.forbiddenThemes.join(", ") || "none"}`,
      `Recent Successes: ${input.recentSuccesses.join(" | ") || "none"}`,
      `Recent Failures: ${input.recentFailures.join(" | ") || "none"}`,
      `Input Channel: ${input.inputChannel?.trim() || "none"}`,
      `[Formula Context] Formulas will use qlib expression syntax. Available columns: $close, $open, $high, $low, $volume, $macro_iip, $macro_cpi, $macro_leverage_trend, $segment_sentiment, $ai_exposure, $kg_centrality. Operators: Ref(col,N), Mean(col,N), Std(col,N), Corr(col1,col2,N), Rank(col). Select featureSignature columns that would appear in a meaningful formula like "(Mean($close,5)-Mean($close,20))/Std($close,20)".`,
    ].join("\n");

    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "theme",
        "hypothesis",
        "featureSignature",
        "noveltyRationale",
        "ideaHashHint",
      ],
      properties: {
        theme: { type: "string" },
        hypothesis: { type: "string" },
        featureSignature: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 8,
        },
        noveltyRationale: { type: "string" },
        ideaHashHint: { type: "string" },
      },
    };
    const apiStyle = this.resolveApiStyle();
    const responsesBody = {
      model: this.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "alpha_theme_proposal",
          strict: true,
          schema,
        },
      },
    };
    const chatCompletionsBody = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nReturn exactly one valid JSON object matching this schema:\n${JSON.stringify(schema)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000); // 300s

    logger.debug("🤖 [LLM Request Body]", {
      body: JSON.stringify(
        apiStyle === "responses" ? responsesBody : chatCompletionsBody,
        null,
        2,
      ),
    });

    const endpoint =
      apiStyle === "responses" ? "/responses" : "/chat/completions";
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(
        apiStyle === "responses" ? responsesBody : chatCompletionsBody,
      ),
      signal: controller.signal,
    });
    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`OpenAI response failed: ${response.status} ${reason}`);
    }
    const json = (await response.json()) as unknown;
    logger.debug("🤖 [LLM Response JSON]", {
      json: JSON.stringify(json, null, 2),
    });
    const outputText =
      apiStyle === "responses"
        ? extractOutputText(json)
        : extractChatCompletionsText(json);
    if (!outputText) {
      throw new Error("OpenAI response missing output_text");
    }
    const parsed = JSON.parse(extractJsonObjectText(outputText)) as Record<
      string,
      unknown
    >;
    const theme = String(parsed.theme || "").trim();
    const hypothesis = String(parsed.hypothesis || "").trim();
    const noveltyRationale = String(parsed.noveltyRationale || "").trim();
    const ideaHashHint = String(parsed.ideaHashHint || "").trim();
    const featureSignature = normalizeFeatureSignature(parsed.featureSignature);
    if (
      !theme ||
      !hypothesis ||
      !ideaHashHint ||
      featureSignature.length === 0
    ) {
      throw new Error("OpenAI proposal missing required fields");
    }

    clearTimeout(timeout);

    return {
      theme,
      hypothesis,
      featureSignature,
      noveltyRationale,
      ideaHashHint,
      model: this.model,
      source: "OPENAI",
    };
  }

  public async chat(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error(
        "OpenAIThemeProvider is disabled: OPENAI_API_KEY is missing.",
      );
    }

    const apiStyle = this.resolveApiStyle();
    const responsesBody = {
      model: this.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    };
    const chatCompletionsBody = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    const endpoint =
      apiStyle === "responses" ? "/responses" : "/chat/completions";
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(
        apiStyle === "responses" ? responsesBody : chatCompletionsBody,
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`OpenAI response failed: ${response.status} ${reason}`);
    }

    const json = (await response.json()) as unknown;
    const outputText =
      apiStyle === "responses"
        ? extractOutputText(json)
        : extractChatCompletionsText(json);
    if (!outputText) {
      throw new Error("OpenAI response missing output_text");
    }

    clearTimeout(timeout);
    return outputText;
  }
}
