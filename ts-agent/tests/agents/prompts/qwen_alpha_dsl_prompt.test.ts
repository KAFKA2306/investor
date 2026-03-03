import { describe, it, expect } from "bun:test";
import {
  buildQwenAlphaDSLPrompt,
  generateAlphaDSLWithQwen,
} from "../../../src/agents/prompts/qwen_alpha_dsl_prompt.ts";

describe("Qwen Alpha DSL Prompt Generation", () => {
  describe("buildQwenAlphaDSLPrompt", () => {
    it("should generate a valid prompt from input", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "日本株の低ボラティリティ効果",
        ["9984", "6758"],
        0.12,
      );
      expect(prompt).toContain("低ボラティリティ市場");
      expect(prompt).toContain("alpha =");
      expect(prompt).toContain("rank");
    });

    it("should include market context in prompt", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "高成長テーマ投資",
        ["4452", "3765"],
        0.18,
      );
      expect(prompt).toContain("市場");
      expect(prompt).toContain("4452");
      expect(prompt).toContain("3765");
      expect(prompt).toContain("高ボラティリティ市場");
    });

    it("should identify low volatility market condition", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.12,
      );
      expect(prompt).toContain("低ボラティリティ市場");
      expect(prompt).toContain("12.0%");
    });

    it("should identify high volatility market condition", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.18,
      );
      expect(prompt).toContain("高ボラティリティ市場");
      expect(prompt).toContain("18.0%");
    });

    it("should properly format symbol list in prompt", () => {
      const symbols = ["9984", "6758", "3765", "4452"];
      const prompt = buildQwenAlphaDSLPrompt(
        "複数銘柄対象",
        symbols,
        0.15,
      );
      expect(prompt).toContain(symbols.join(", "));
    });

    it("should include alpha prompt in market context section", () => {
      const alphaPrompt = "独自のアルファ戦略テスト";
      const prompt = buildQwenAlphaDSLPrompt(alphaPrompt, ["1234"], 0.10);
      expect(prompt).toContain(alphaPrompt);
    });

    it("should include all required sections in template", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      expect(prompt).toContain("Task");
      expect(prompt).toContain("Context");
      expect(prompt).toContain("Requirements");
      expect(prompt).toContain("Output");
    });

    it("should include allowed operations in requirements", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      expect(prompt).toContain("rank()");
      expect(prompt).toContain("scale()");
      expect(prompt).toContain("abs()");
      expect(prompt).toContain("sign()");
      expect(prompt).toContain("log()");
    });

    it("should include known factors in requirements", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      expect(prompt).toContain("momentum");
      expect(prompt).toContain("value");
      expect(prompt).toContain("size");
      expect(prompt).toContain("volatility");
      expect(prompt).toContain("quality");
      expect(prompt).toContain("growth");
      expect(prompt).toContain("dividend");
    });

    it("should include example format in requirements", () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      expect(prompt).toContain("alpha = rank(momentum) * -1 + rank(value) * 0.5");
    });
  });

  describe("generateAlphaDSLWithQwen", () => {
    it("should generate a valid DSL from prompt", async () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      const dsl = await generateAlphaDSLWithQwen(prompt);
      expect(dsl).toContain("alpha =");
      expect(dsl).toContain("rank");
    });

    it("should return DSL as single line starting with 'alpha ='", async () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      const dsl = await generateAlphaDSLWithQwen(prompt);
      expect(dsl.trim().startsWith("alpha =")).toBe(true);
      // Should be mostly single line (allowing minimal whitespace)
      const lines = dsl.trim().split("\n").length;
      expect(lines).toBeLessThanOrEqual(2);
    });

    it("should accept custom modelId parameter", async () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      const dsl = await generateAlphaDSLWithQwen(prompt, "qwen:7b");
      expect(dsl).toContain("alpha =");
    });

    it("should use default modelId when not provided", async () => {
      const prompt = buildQwenAlphaDSLPrompt(
        "テスト",
        ["1234"],
        0.10,
      );
      const dsl = await generateAlphaDSLWithQwen(prompt);
      expect(dsl).toBeDefined();
      expect(dsl.length).toBeGreaterThan(0);
    });
  });
});
