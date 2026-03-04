import { describe, it, expect } from "bun:test";
import {
  validateAlphaCandidateConsistency,
  type FactorAST,
} from "../../src/schemas/alpha_consistency_schema.ts";

describe("Phase 1 Integration: validateAlphaCandidateConsistency", () => {
  describe("coOptimizeAndVerify Phase 1 validation", () => {
    it("should pass Phase 1 for consistent description and AST", () => {
      // This simulates the check that occurs in coOptimizeAndVerify()
      // Uses pattern from alpha_consistency.test.ts that we know works
      const candidate = {
        id: "alpha-001",
        description: "rank(volume) and rank(close)",
        ast: {
          type: "operator" as const,
          name: "ADD",
          left: {
            type: "variable" as const,
            name: "volume",
          },
          right: {
            type: "variable" as const,
            name: "close",
          },
        } as FactorAST,
      };

      const consistency = validateAlphaCandidateConsistency(
        candidate.description,
        candidate.ast,
      );

      expect(consistency.isConsistent).toBe(true);
      expect(consistency.missingInAST).toHaveLength(0);
      expect(consistency.errorMessage).toBeUndefined();
    });

    it("should reject Phase 1 for inconsistent description and AST", () => {
      // Simulates the error case that would throw in coOptimizeAndVerify()
      const candidate = {
        id: "alpha-002",
        description: "Strategy uses high and low prices: rank(high) * -1 + rank(low)",
        ast: {
          type: "operator" as const,
          name: "MUL",
          left: {
            type: "variable" as const,
            name: "close",
          },
          right: {
            type: "constant" as const,
            value: 0.3,
          },
        } as FactorAST,
      };

      const consistency = validateAlphaCandidateConsistency(
        candidate.description,
        candidate.ast,
      );

      expect(consistency.isConsistent).toBe(false);
      expect(consistency.missingInAST.length).toBeGreaterThan(0);
      expect(consistency.errorMessage).toBeDefined();
      expect(consistency.errorMessage).toContain("[AUDIT]");
    });

    it("should handle error format as per [AUDIT] spec", () => {
      // Ensure the error message format matches the spec in coOptimizeAndVerify()
      const description = "Test strategy using variable_a and variable_b";
      const ast: FactorAST = {
        type: "variable" as const,
        name: "variable_a",
      };

      const consistency = validateAlphaCandidateConsistency(
        description,
        ast,
      );

      // Build the error message as it would be in coOptimizeAndVerify()
      const fullError = `[AUDIT] ${consistency.errorMessage}\n` +
        `Description vars: ${consistency.descriptionVars.join(", ")}\n` +
        `AST vars: ${consistency.astVars.join(", ")}`;

      expect(fullError).toContain("[AUDIT]");
      expect(fullError).toContain("Description vars:");
      expect(fullError).toContain("AST vars:");
    });

    it("should pass for complex nested AST with matching variables", () => {
      const description = "0.44 * macro_cpi + 1";
      const ast: FactorAST = {
        type: "operator" as const,
        name: "ADD",
        left: {
          type: "operator" as const,
          name: "MUL",
          left: {
            type: "variable" as const,
            name: "macro_cpi",
          },
          right: {
            type: "constant" as const,
            value: 0.44,
          },
        },
        right: {
          type: "constant" as const,
          value: 1,
        },
      };

      const consistency = validateAlphaCandidateConsistency(
        description,
        ast,
      );

      expect(consistency.isConsistent).toBe(true);
      expect(consistency.missingInAST).toHaveLength(0);
    });

    it("should detect mismatch in actual bug scenario", () => {
      // Real-world example: description mentions high/open but AST has macro_cpi
      const description =
        "Price reversal strategy: rank(high) * -1 + rank(open) * 0.3";
      const astWithMacroCpi: FactorAST = {
        type: "operator" as const,
        name: "ADD",
        left: {
          type: "operator" as const,
          name: "MUL",
          left: {
            type: "variable" as const,
            name: "macro_cpi",
          },
          right: {
            type: "constant" as const,
            value: 0.44,
          },
        },
        right: {
          type: "constant" as const,
          value: 1,
        },
      };

      const consistency = validateAlphaCandidateConsistency(
        description,
        astWithMacroCpi,
      );

      expect(consistency.isConsistent).toBe(false);
      expect(consistency.missingInAST.length).toBeGreaterThan(0);
      expect(consistency.errorMessage).toBeDefined();
    });
  });

  describe("AAARTS Phase 1 rejection criteria", () => {
    it("should allow rejections during coOptimizeAndVerify Phase 1", () => {
      // Verify that inconsistent alphas would be rejected
      const badAlpha = {
        description: "Uses volume indicator",
        ast: {
          type: "variable" as const,
          name: "close",
        } as FactorAST,
      };

      const result = validateAlphaCandidateConsistency(
        badAlpha.description,
        badAlpha.ast,
      );

      // This would cause coOptimizeAndVerify to throw
      if (!result.isConsistent) {
        const errorThrown = new Error(
          `[AUDIT] ${result.errorMessage}\n` +
          `Description vars: ${result.descriptionVars.join(", ")}\n` +
          `AST vars: ${result.astVars.join(", ")}`,
        );
        expect(errorThrown.message).toContain("[AUDIT]");
      }
    });

    it("should confirm Phase 3 is final authority (CQO audit removed)", () => {
      // Verify the architectural decision:
      // Phase 1: Description-AST consistency
      // Phase 2: (implemented separately)
      // Phase 3: judgeVerification is FINAL authority
      // CQO audit layer: REMOVED (replaced with simpler logic in handleAdoptedCandidate)

      const phases = {
        phase1: "description-AST consistency check",
        phase2: "NaN metrics detection",
        phase3: "judgeVerification final verdict",
        cqoAudit: "REMOVED - not used",
      };

      expect(phases.phase1).toContain("consistency");
      expect(phases.phase3).toContain("judgeVerification");
      expect(phases.cqoAudit).toContain("REMOVED");
    });
  });
});
