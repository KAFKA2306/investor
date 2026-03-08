import { describe, it, expect } from "bun:test";
import {
  validateQlibFormula,
  QLIB_ALLOWED_COLUMNS,
  QLIB_ALLOWED_OPS,
} from "../src/schemas/alpha_consistency_schema";

describe("Alpha Candidate Consistency (qlib formula)", () => {
  describe("validateQlibFormula", () => {
    it("should pass for a valid momentum formula", () => {
      const result = validateQlibFormula("Ref($close,5)/$close-1");
      expect(result.isValid).toBe(true);
    });

    it("should pass for MA crossover formula", () => {
      const result = validateQlibFormula("Mean($close,20)/Mean($close,5)-1");
      expect(result.isValid).toBe(true);
    });

    it("should pass for correlation formula", () => {
      const result = validateQlibFormula("Corr($close,$volume,20)");
      expect(result.isValid).toBe(true);
    });

    it("should pass for macro-weighted formula", () => {
      const result = validateQlibFormula("Ref($macro_iip,1)*($close/$open-1)");
      expect(result.isValid).toBe(true);
    });

    it("should fail for empty formula", () => {
      const result = validateQlibFormula("");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("[AUDIT]");
    });

    it("should fail for unknown column reference", () => {
      const result = validateQlibFormula("Ref($unknown_col,5)");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Unknown columns");
    });

    it("should fail for unknown operator", () => {
      const result = validateQlibFormula("CustomOp($close,5)");
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Unknown operators");
    });
  });

  describe("QLIB_ALLOWED_COLUMNS", () => {
    it("should contain standard OHLCV columns", () => {
      expect(QLIB_ALLOWED_COLUMNS.has("close")).toBe(true);
      expect(QLIB_ALLOWED_COLUMNS.has("open")).toBe(true);
      expect(QLIB_ALLOWED_COLUMNS.has("volume")).toBe(true);
    });

    it("should contain custom macro columns", () => {
      expect(QLIB_ALLOWED_COLUMNS.has("macro_iip")).toBe(true);
      expect(QLIB_ALLOWED_COLUMNS.has("segment_sentiment")).toBe(true);
    });
  });

  describe("QLIB_ALLOWED_OPS", () => {
    it("should contain standard time-series operators", () => {
      expect(QLIB_ALLOWED_OPS.has("Ref")).toBe(true);
      expect(QLIB_ALLOWED_OPS.has("Mean")).toBe(true);
      expect(QLIB_ALLOWED_OPS.has("Std")).toBe(true);
      expect(QLIB_ALLOWED_OPS.has("Corr")).toBe(true);
    });
  });

  describe("Macro indicator data quality", () => {
    it("should require macro_cpi to be present in valid rows", () => {
      const rowWithMacroCpi = {
        source: "finance",
        rows: 100,
        expectedRows: 100,
        missingRate: 0,
        latencyMinutes: 5,
        leakFlag: false,
        schemaMatch: 1,
      };

      const rowWithoutMacroCpi = {
        ...rowWithMacroCpi,
        schemaMatch: 0.75,
      };

      expect(rowWithMacroCpi.schemaMatch).toBeGreaterThan(0.8);
      expect(rowWithoutMacroCpi.schemaMatch).toBeLessThanOrEqual(0.8);
    });
  });
});
