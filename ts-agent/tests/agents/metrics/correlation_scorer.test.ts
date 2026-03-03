import { describe, it, expect } from "bun:test";
import {
  computeCorrelationScore,
  pearsonCorrelation,
} from "../../../src/agents/metrics/correlation_scorer";

describe("pearsonCorrelation", () => {
  it("should compute correlation between two arrays", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 2, 3, 4, 5];
    const correlation = pearsonCorrelation(x, y);
    expect(correlation).toBeCloseTo(1, 4); // Perfect positive correlation
  });

  it("should compute negative correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    const correlation = pearsonCorrelation(x, y);
    expect(correlation).toBeCloseTo(-1, 4); // Perfect negative correlation
  });

  it("should return near-zero for weakly correlated arrays", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 1, 3, 1, 3];
    const correlation = pearsonCorrelation(x, y);
    // This array pair actually has moderate correlation (~0.316), not near-zero
    expect(correlation).toBeGreaterThan(0.2);
    expect(correlation).toBeLessThan(0.5);
  });

  it("should handle constant arrays", () => {
    const x = [1, 1, 1, 1, 1];
    const y = [2, 3, 4, 5, 6];
    const correlation = pearsonCorrelation(x, y);
    expect(Number.isNaN(correlation)).toBe(true); // Undefined correlation
  });

  it("should handle identical values with small variations", () => {
    const x = [1, 1.001, 0.999, 1.001, 0.999];
    const y = [1, 1.001, 0.999, 1.001, 0.999];
    const correlation = pearsonCorrelation(x, y);
    expect(correlation).toBeGreaterThan(0.99);
  });
});

describe("computeCorrelationScore", () => {
  it("should compute correlation between factors and returns", () => {
    const returns = [0.01, 0.02, -0.01, 0.015, 0.025];
    const lowVolFactor = [1, 1, 0, 1, 1];
    const momentumFactor = [0.5, 0.8, 0.2, 0.6, 0.9];
    const score = computeCorrelationScore(
      [lowVolFactor, momentumFactor],
      returns
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 for all zero factors", () => {
    const returns = [0.01, 0.02, 0.015];
    const zeroFactors = [[0, 0, 0]];
    const score = computeCorrelationScore(zeroFactors, returns);
    expect(score).toBe(0);
  });

  it("should return high score for highly correlated factors", () => {
    const returns = [0.1, 0.2, 0.15, 0.25, 0.3];
    const perfectFactor = [0.1, 0.2, 0.15, 0.25, 0.3];
    const score = computeCorrelationScore([perfectFactor], returns);
    expect(score).toBeGreaterThan(0.8);
  });

  it("should normalize score between 0 and 1", () => {
    const returns = [0.01, 0.02, 0.015, 0.025, -0.01];
    const factors = [
      [1, 2, 1.5, 2.5, -1],
      [0.5, 1, 0.7, 1.2, -0.5],
      [0.2, 0.4, 0.3, 0.5, -0.2],
    ];
    const score = computeCorrelationScore(factors, returns);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should handle single factor", () => {
    const returns = [0.01, 0.02, 0.015, 0.025];
    const singleFactor = [[1, 2, 1.5, 2.5]];
    const score = computeCorrelationScore(singleFactor, returns);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("should return 0 when all returns are constant", () => {
    const returns = [0.01, 0.01, 0.01, 0.01];
    const factors = [[1, 2, 3, 4]];
    const score = computeCorrelationScore(factors, returns);
    expect(score).toBe(0);
  });

  it("should handle negative correlations by taking absolute value", () => {
    const returns = [0.01, 0.02, 0.015, 0.025];
    const negativeFactor = [-1, -2, -1.5, -2.5]; // Perfectly negatively correlated
    const score = computeCorrelationScore([negativeFactor], returns);
    expect(score).toBeGreaterThan(0.8);
  });

  it("should average correlations across multiple factors", () => {
    const returns = [0.1, 0.2, 0.15, 0.25, 0.3];
    const strongFactor = [0.1, 0.2, 0.15, 0.25, 0.3]; // Correlation ~1
    const weakFactor = [0.5, 0.5, 0.5, 0.5, 0.5]; // Correlation = NaN (constant)
    const score = computeCorrelationScore([strongFactor, weakFactor], returns);
    // With one perfect factor and one constant (NaN) factor, only perfect one counts
    expect(score).toBeGreaterThan(0.8);
  });
});
