import { describe, it, expect } from "bun:test";
import {
  extractFactorsFromDSL,
  computeOrthogonalityScore,
  type PlaybookPattern,
} from "../../../src/agents/metrics/orthogonality_scorer";

describe("Orthogonality Scorer", () => {
  describe("extractFactorsFromDSL", () => {
    it("should extract factors from DSL string", () => {
      const dsl = "alpha = rank(low_volatility) + rank(momentum)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("low_volatility");
      expect(factors).toContain("momentum");
      expect(factors.length).toBe(2);
    });

    it("should extract single factor from simple DSL", () => {
      const dsl = "alpha = rank(momentum)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("momentum");
      expect(factors.length).toBe(1);
    });

    it("should extract multiple factors with different operators", () => {
      const dsl = "alpha = rank(momentum) * scale(value) + abs(quality)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("momentum");
      expect(factors).toContain("value");
      expect(factors).toContain("quality");
      expect(factors.length).toBe(3);
    });

    it("should handle factors with underscores and numbers", () => {
      const dsl = "alpha = rank(low_vol_10d) + rank(mean_revert_5d)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("low_vol_10d");
      expect(factors).toContain("mean_revert_5d");
    });

    it("should exclude function names like rank, scale, abs", () => {
      const dsl = "alpha = rank(momentum) + scale(value) + abs(quality) + sign(diff)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).not.toContain("rank");
      expect(factors).not.toContain("scale");
      expect(factors).not.toContain("abs");
      expect(factors).not.toContain("sign");
    });

    it("should handle complex nested DSL", () => {
      const dsl =
        "alpha = rank(log(momentum)) + scale(abs(value)) - sign(quality)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("momentum");
      expect(factors).toContain("value");
      expect(factors).toContain("quality");
      expect(factors.length).toBe(3);
    });

    it("should return empty array for DSL with no factors", () => {
      const dsl = "alpha = 0.5";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors.length).toBe(0);
    });

    it("should return unique factors only once", () => {
      const dsl = "alpha = rank(momentum) + scale(momentum)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors.length).toBe(1);
      expect(factors).toContain("momentum");
    });
  });

  describe("computeOrthogonalityScore", () => {
    it("should return 1.0 for completely new factor set", () => {
      const dslFactors = ["new_factor_xyz"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(1.0);
    });

    it("should return 0.0 for identical factor set", () => {
      const dslFactors = ["momentum", "value"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(0.0);
    });

    it("should return partial score for partial overlap", () => {
      const dslFactors = ["momentum", "new_factor"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBeGreaterThan(0.0);
      expect(score).toBeLessThan(1.0);
    });

    it("should calculate correct Jaccard distance for partial overlap", () => {
      // A = [momentum, new], B = [momentum, value]
      // intersection = [momentum] (size 1)
      // union = [momentum, new, value] (size 3)
      // Jaccard similarity = 1/3
      // Jaccard distance = 1 - 1/3 = 2/3 ≈ 0.667
      const dslFactors = ["momentum", "new"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(Math.abs(score - 0.667)).toBeLessThan(0.01);
    });

    it("should handle empty dslFactors", () => {
      const dslFactors: string[] = [];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(1.0);
    });

    it("should handle empty patterns array", () => {
      const dslFactors = ["momentum", "value"];
      const patterns: PlaybookPattern[] = [];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(1.0);
    });

    it("should return best (highest) score across multiple patterns", () => {
      const dslFactors = ["new_factor"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.5 },
        { factorSet: ["quality"], fitnessScore: 0.6 },
        { factorSet: ["new_factor"], fitnessScore: 0.7 }, // Exact match
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      // Should be 0.0 because it exactly matches one pattern
      expect(score).toBe(0.0);
    });

    it("should prefer maximum orthogonality across multiple patterns", () => {
      const dslFactors = ["brand_new", "another_new"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum"], fitnessScore: 0.5 },
        { factorSet: ["value"], fitnessScore: 0.6 },
        { factorSet: ["quality"], fitnessScore: 0.7 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      // All patterns have zero intersection, so score should be 1.0
      expect(score).toBe(1.0);
    });

    it("should handle single factor in both sets", () => {
      const dslFactors = ["momentum"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(0.0);
    });

    it("should handle multiple patterns and pick the minimum Jaccard distance", () => {
      const dslFactors = ["momentum", "value", "quality"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum"], fitnessScore: 0.5 }, // 1 common, 3 total: distance = 2/3
        { factorSet: ["momentum", "value", "quality"], fitnessScore: 0.6 }, // 3 common, 3 total: distance = 0
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      // Should be minimum (best) score across patterns: 0.0
      expect(score).toBe(0.0);
    });

    it("should be case-sensitive for factor names", () => {
      const dslFactors = ["Momentum"];
      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum"], fitnessScore: 0.5 },
      ];
      const score = computeOrthogonalityScore(dslFactors, patterns);
      expect(score).toBe(1.0);
    });
  });

  describe("integration tests", () => {
    it("should work end-to-end: extract factors and compute score", () => {
      const dsl = "alpha = rank(momentum) + rank(quality)";
      const factors = extractFactorsFromDSL(dsl);
      expect(factors).toContain("momentum");
      expect(factors).toContain("quality");

      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.65 },
        { factorSet: ["value", "quality"], fitnessScore: 0.60 },
      ];

      const score = computeOrthogonalityScore(factors, patterns);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should find truly novel factor combinations", () => {
      const dsl = "alpha = rank(exotic_factor_xyz) + rank(novel_metric_abc)";
      const factors = extractFactorsFromDSL(dsl);

      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.65 },
        { factorSet: ["quality", "profitability"], fitnessScore: 0.60 },
        { factorSet: ["size", "growth"], fitnessScore: 0.55 },
      ];

      const score = computeOrthogonalityScore(factors, patterns);
      expect(score).toBe(1.0);
    });

    it("should recognize similar but not identical factors", () => {
      const dsl = "alpha = rank(momentum) + rank(value)";
      const factors = extractFactorsFromDSL(dsl);

      const patterns: PlaybookPattern[] = [
        { factorSet: ["momentum", "value"], fitnessScore: 0.65 },
      ];

      const score = computeOrthogonalityScore(factors, patterns);
      expect(score).toBe(0.0);
    });
  });
});
