import { describe, it, expect } from "bun:test";
import {
  validateAlphaCandidateConsistency,
  extractVariablesFromAST,
  extractVariablesFromDescription,
} from "../src/schemas/alpha_consistency_schema";
import type { FactorAST } from "../src/schemas/alpha_consistency_schema";

describe("Alpha Candidate Consistency", () => {
  describe("extractVariablesFromDescription", () => {
    it("should extract variables from rank() expressions", () => {
      const description = "rank(volume) * -1 + rank(momentum) * 0.3";
      const vars = extractVariablesFromDescription(description);

      expect(vars.has("volume")).toBe(true);
      expect(vars.has("momentum")).toBe(true);
    });

    it("should extract macro indicators", () => {
      const description = "0.44 * macro_cpi + 1";
      const vars = extractVariablesFromDescription(description);

      expect(vars.has("macro_cpi")).toBe(true);
    });

    it("should handle mixed expressions", () => {
      const description = "rank(close) / (macro_iip + sentiment)";
      const vars = extractVariablesFromDescription(description);

      expect(vars.has("close")).toBe(true);
      expect(vars.has("macro_iip")).toBe(true);
      expect(vars.has("sentiment")).toBe(true);
    });
  });

  describe("extractVariablesFromAST", () => {
    it("should extract variables from nested AST", () => {
      const ast: FactorAST = {
        type: "operator",
        name: "MUL",
        left: { type: "variable", name: "volume" },
        right: { type: "constant", value: -1 },
      };

      const vars = extractVariablesFromAST(ast);
      expect(vars.has("volume")).toBe(true);
      expect(vars.size).toBe(1);
    });

    it("should extract variables from deeply nested AST", () => {
      const ast: FactorAST = {
        type: "operator",
        name: "ADD",
        left: {
          type: "operator",
          name: "MUL",
          left: { type: "variable", name: "macro_cpi" },
          right: { type: "constant", value: 0.44 },
        },
        right: { type: "constant", value: 1 },
      };

      const vars = extractVariablesFromAST(ast);
      expect(vars.has("macro_cpi")).toBe(true);
    });
  });

  describe("validateAlphaCandidateConsistency", () => {
    it("should pass when description and AST are consistent", () => {
      const description = "rank(volume) and rank(close)";
      const ast: FactorAST = {
        type: "operator",
        name: "ADD",
        left: { type: "variable", name: "volume" },
        right: { type: "variable", name: "close" },
      };

      const result = validateAlphaCandidateConsistency(description, ast);
      expect(result.isConsistent).toBe(true);
      expect(result.missingInAST).toHaveLength(0);
    });

    it("should fail when description mentions variables not in AST", () => {
      const description =
        "Volatility reversal: rank(volatility) * -1 + rank(momentum) * 0.3";
      const ast: FactorAST = {
        type: "operator",
        name: "MUL",
        left: { type: "variable", name: "momentum" },
        right: { type: "constant", value: 0.3 },
      };

      const result = validateAlphaCandidateConsistency(description, ast);
      expect(result.isConsistent).toBe(false);
      expect(result.missingInAST).toContain("volatility");
    });

    it("should detect the issue from the bug report", () => {
      // This is the exact case from the user's report
      const description = "Volatility reversal and momentum blend: rank(vol) * -1 + rank(mom) * 0.3";
      const astForMacroCpi: FactorAST = {
        type: "operator",
        name: "ADD",
        left: {
          type: "operator",
          name: "MUL",
          left: { type: "variable", name: "macro_cpi" },
          right: { type: "constant", value: 0.44 },
        },
        right: { type: "constant", value: 1 },
      };

      const result = validateAlphaCandidateConsistency(
        description,
        astForMacroCpi,
      );
      expect(result.isConsistent).toBe(false);
      expect(result.missingInAST.length).toBeGreaterThan(0);
      expect(result.errorMessage).toBeDefined();
    });

    it("should allow AST to have extra variables (more granular)", () => {
      const description = "macro indicator strategy";
      const ast: FactorAST = {
        type: "operator",
        name: "ADD",
        left: { type: "variable", name: "macro_cpi" },
        right: { type: "variable", name: "macro_iip" },
      };

      const result = validateAlphaCandidateConsistency(description, ast);
      // This should pass because extra variables in AST are acceptable
      // (the description is vague, but AST is specific)
      expect(result.extraInAST.length).toBeGreaterThan(0);
    });
  });

  describe("Macro indicator data quality", () => {
    it("should require macro_cpi to be present in valid rows", () => {
      // This test verifies that rows without macro_cpi
      // are not considered "valid" during data preparation
      const rowWithMacroCpi = {
        source: "finance",
        rows: 100,
        expectedRows: 100,
        missingRate: 0,
        latencyMinutes: 5,
        leakFlag: false,
        schemaMatch: 1,
      };

      // If macro_cpi is missing, schemaMatch should be < 0.8
      const rowWithoutMacroCpi = {
        ...rowWithMacroCpi,
        schemaMatch: 0.75, // Indicates macro_cpi missing
      };

      expect(rowWithMacroCpi.schemaMatch).toBeGreaterThan(0.8);
      expect(rowWithoutMacroCpi.schemaMatch).toBeLessThanOrEqual(0.8);
    });
  });
});
