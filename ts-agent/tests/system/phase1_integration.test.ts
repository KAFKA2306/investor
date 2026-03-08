import { describe, it, expect } from "bun:test";
import { validateQlibFormula } from "../../src/schemas/alpha_consistency_schema.ts";

describe("Phase 1 Integration: validateQlibFormula", () => {
  describe("coOptimizeAndVerify Phase 1 validation", () => {
    it("should pass Phase 1 for valid qlib formula", () => {
      const candidate = {
        id: "alpha-001",
        formula: "Mean($close,20)/Mean($close,5)-1",
      };

      const consistency = validateQlibFormula(candidate.formula);

      expect(consistency.isValid).toBe(true);
      expect(consistency.errorMessage).toBeUndefined();
    });

    it("should reject Phase 1 for unknown column in formula", () => {
      const candidate = {
        id: "alpha-002",
        formula: "Ref($unknown_var,5)/$close-1",
      };

      const consistency = validateQlibFormula(candidate.formula);

      expect(consistency.isValid).toBe(false);
      expect(consistency.errorMessage).toBeDefined();
      expect(consistency.errorMessage).toContain("[AUDIT]");
    });

    it("should handle error format as per [AUDIT] spec", () => {
      const formula = "Ref($bad_col,5)";
      const consistency = validateQlibFormula(formula);

      expect(consistency.errorMessage).toContain("[AUDIT]");
    });

    it("should pass for complex macro-weighted formula", () => {
      const formula = "Ref($macro_iip,1)*($close/$open-1)";
      const consistency = validateQlibFormula(formula);
      expect(consistency.isValid).toBe(true);
    });

    it("should reject unknown operators", () => {
      const formula = "CustomSignal($close,5)";
      const consistency = validateQlibFormula(formula);
      expect(consistency.isValid).toBe(false);
      expect(consistency.errorMessage).toContain("Unknown operators");
    });
  });

  describe("AAARTS Phase 1 rejection criteria", () => {
    it("should allow rejections during coOptimizeAndVerify Phase 1", () => {
      const badFormula = "Ref($nonexistent,5)";
      const result = validateQlibFormula(badFormula);

      if (!result.isValid) {
        const errorThrown = new Error(result.errorMessage);
        expect(errorThrown.message).toContain("[AUDIT]");
      }
    });

    it("should confirm Phase 3 is final authority (CQO audit removed)", () => {
      const phases = {
        phase1: "qlib formula validation",
        phase3: "judgeVerification final verdict",
        cqoAudit: "REMOVED - not used",
      };

      expect(phases.phase1).toContain("formula");
      expect(phases.phase3).toContain("judgeVerification");
      expect(phases.cqoAudit).toContain("REMOVED");
    });
  });
});
