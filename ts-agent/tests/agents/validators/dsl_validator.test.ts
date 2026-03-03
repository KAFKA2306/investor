import { describe, it, expect } from "bun:test";
import {
  isValidDSL,
  repairDSL,
  validateDSL,
} from "../../../src/agents/validators/dsl_validator";

describe("DSL Validator", () => {
  describe("isValidDSL", () => {
    it("should validate correct DSL", () => {
      const dsl = "alpha = rank(momentum) * -1";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should validate DSL with multiple functions", () => {
      const dsl = "alpha = rank(value) + scale(momentum)";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should validate DSL with allowed factors", () => {
      const dsl = "alpha = rank(momentum)";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should validate DSL with nested functions", () => {
      const dsl = "alpha = abs(log(rank(momentum)))";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should reject DSL without 'alpha ='", () => {
      const dsl = "rank(momentum) * -1";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject DSL with invalid functions", () => {
      const dsl = "alpha = invalid_func(momentum)";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject DSL with unknown factors", () => {
      const dsl = "alpha = rank(unknown_factor)";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject empty DSL", () => {
      const dsl = "";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject DSL with dangerous characters", () => {
      const dsl = "alpha = rank(momentum); DROP TABLE;";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject DSL with invalid operators", () => {
      const dsl = "alpha = rank(momentum) @ scale(value)";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should allow low_vol variant", () => {
      const dsl = "alpha = rank(low_vol)";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should allow low_volatility variant", () => {
      const dsl = "alpha = rank(low_volatility)";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should validate DSL with all allowed operators", () => {
      const dsl = "alpha = rank(momentum) + scale(value) - abs(volatility) * min(growth) / max(quality)";
      expect(isValidDSL(dsl)).toBe(true);
    });
  });

  describe("repairDSL", () => {
    it("should repair DSL by adding 'alpha ='", () => {
      const dsl = "rank(momentum) * -1";
      const repaired = repairDSL(dsl);
      expect(repaired).not.toBeNull();
      expect(repaired).toContain("alpha =");
    });

    it("should return valid DSL if already valid", () => {
      const dsl = "alpha = rank(momentum)";
      const repaired = repairDSL(dsl);
      expect(repaired).toBe(dsl);
    });

    it("should trim whitespace and repair", () => {
      const dsl = "  rank(momentum)  ";
      const repaired = repairDSL(dsl);
      expect(repaired).not.toBeNull();
      if (repaired) {
        expect(isValidDSL(repaired)).toBe(true);
      }
    });

    it("should return null for unfixable DSL with invalid functions", () => {
      const dsl = "invalid_func(momentum)";
      const repaired = repairDSL(dsl);
      expect(repaired).toBeNull();
    });

    it("should return null for unfixable DSL with unknown factors", () => {
      const dsl = "rank(unknown_factor)";
      const repaired = repairDSL(dsl);
      expect(repaired).toBeNull();
    });

    it("should return null for completely malformed DSL", () => {
      const dsl = "() * @#$% invalid";
      const repaired = repairDSL(dsl);
      expect(repaired).toBeNull();
    });

    it("should return null for empty string", () => {
      const dsl = "";
      const repaired = repairDSL(dsl);
      expect(repaired).toBeNull();
    });
  });

  describe("validateDSL", () => {
    it("should provide detailed validation report for valid DSL", () => {
      const dsl = "alpha = rank(momentum)";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should provide error messages for invalid DSL", () => {
      const dsl = "alpha = rank(unknown_factor)";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should provide repaired DSL when auto-repair succeeds", () => {
      const dsl = "rank(momentum) * -1";
      const result = validateDSL(dsl);
      expect(result.repaired).not.toBeUndefined();
      if (result.repaired) {
        expect(isValidDSL(result.repaired)).toBe(true);
      }
    });

    it("should return null for repaired when validation passes", () => {
      const dsl = "alpha = rank(momentum)";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(true);
      expect(result.repaired).toBeUndefined();
    });

    it("should report unfixable DSL with null repaired", () => {
      const dsl = "invalid_func(momentum)";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(false);
      expect(result.repaired).toBeNull();
    });

    it("should handle empty DSL", () => {
      const dsl = "";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should provide comprehensive error messages", () => {
      const dsl = "alpha = invalid_func(unknown_factor)";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should contain at least one error about invalid function or unknown factor
      const errorText = result.errors.join(" ");
      const hasRelevantError =
        errorText.toLowerCase().includes("invalid") ||
        errorText.toLowerCase().includes("unknown") ||
        errorText.toLowerCase().includes("factor");
      expect(hasRelevantError).toBe(true);
    });

    it("should validate multiple valid factors", () => {
      const validFactors = [
        "alpha = rank(momentum)",
        "alpha = scale(value)",
        "alpha = abs(volatility)",
        "alpha = sign(quality)",
        "alpha = log(growth)",
        "alpha = max(dividend)",
        "alpha = min(size)",
        "alpha = rank(low_vol)",
        "alpha = rank(low_volatility)",
      ];

      for (const dsl of validFactors) {
        const result = validateDSL(dsl);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle DSL with extra whitespace", () => {
      const dsl = "alpha   =   rank(   momentum   )";
      const result = validateDSL(dsl);
      expect(result.valid).toBe(true);
    });

    it("should reject DSL with comments", () => {
      const dsl = "alpha = rank(momentum) // comment";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should be case-insensitive for 'alpha'", () => {
      const dsl = "ALPHA = rank(momentum)";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should handle nested parentheses", () => {
      const dsl = "alpha = rank(abs(log(momentum)))";
      expect(isValidDSL(dsl)).toBe(true);
    });

    it("should reject unbalanced parentheses", () => {
      const dsl = "alpha = rank(momentum))";
      expect(isValidDSL(dsl)).toBe(false);
    });

    it("should reject missing closing parenthesis", () => {
      const dsl = "alpha = rank(momentum";
      expect(isValidDSL(dsl)).toBe(false);
    });
  });
});
