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

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const DEFAULT_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const fallbackTheme = (): ThemeProposal => ({
  theme: "Adaptive Regime Cross-Signal",
  hypothesis:
    "Regime transition and microstructure divergence jointly improve short-horizon alpha detection.",
  featureSignature: ["macro_iip", "macro_cpi", "volume", "close"],
  noveltyRationale:
    "Fallback theme used because remote proposal was unavailable.",
  ideaHashHint: "fallback_adaptive_regime_cross_signal",
  model: DEFAULT_MODEL,
  source: "FALLBACK",
});

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

const normalizeFeatureSignature = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
    .filter((x): x is string => x.length > 0)
    .slice(0, 8);
};

export class OpenAIThemeProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = DEFAULT_MODEL;
  private readonly baseUrl = DEFAULT_BASE_URL;

  public isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  public async propose(input: ThemeProposalInput): Promise<ThemeProposal> {
    if (!this.isEnabled()) {
      return fallbackTheme();
    }

    const systemPrompt =
      "You are an autonomous quant idea generator. Return only valid JSON matching the requested schema.";
    const userPrompt = [
      "Generate exactly one novel alpha exploration theme for Japanese equities.",
      "Avoid overlap with forbidden themes and reduce duplication with existing themes.",
      "Keep hypothesis concise and falsifiable.",
      `Mission: ${input.missionContext}`,
      `Market Context: ${input.marketContext}`,
      `Existing Themes: ${input.existingThemes.join(", ") || "none"}`,
      `Forbidden Themes: ${input.forbiddenThemes.join(", ") || "none"}`,
      `Recent Successes: ${input.recentSuccesses.join(" | ") || "none"}`,
      `Recent Failures: ${input.recentFailures.join(" | ") || "none"}`,
      `User Intent: ${input.userIntent?.trim() || "none"}`,
      `Input Channel: ${input.inputChannel?.trim() || "none"}`,
    ].join("\n");

    const body = {
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
          schema: {
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
          },
        },
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const reason = await response.text();
      throw new Error(`OpenAI response failed: ${response.status} ${reason}`);
    }
    const json = (await response.json()) as unknown;
    const outputText = extractOutputText(json);
    if (!outputText) {
      throw new Error("OpenAI response missing output_text");
    }
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
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
}
