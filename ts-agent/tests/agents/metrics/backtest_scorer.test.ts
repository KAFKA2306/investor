import { describe, it, expect } from "bun:test";
import { computeBacktestScore } from "../../../src/agents/metrics/backtest_scorer";

describe("computeBacktestScore", () => {
  it("should compute backtest score from Sharpe", () => {
    const score = computeBacktestScore(2.0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should return 0 for poor Sharpe", () => {
    const score = computeBacktestScore(0.5);
    expect(score).toBe(0);
  });


  it("should return high score for strong Sharpe", () => {
    const score = computeBacktestScore(2.5);
    expect(score).toBeGreaterThan(0.7);
  });

  it("should normalize Sharpe ratio (min=1.5, ideal=2.0)", () => {
    // At min threshold (1.5) -> should give 0.0
    const minScore = computeBacktestScore(1.5);
    expect(minScore).toBeCloseTo(0.0, 1);

    // At ideal threshold (2.0) -> should give 1.0
    const idealScore = computeBacktestScore(2.0);
    expect(idealScore).toBeCloseTo(1.0, 1);

    // Above ideal should clip to 1.0
    const aboveIdealScore = computeBacktestScore(3.0);
    expect(aboveIdealScore).toBeCloseTo(1.0, 1);
  });


  it("should return 1.0 for perfect metrics", () => {
    const score = computeBacktestScore(2.5);
    expect(score).toBe(1.0);
  });

  it("should handle edge case: zero Sharpe", () => {
    const score = computeBacktestScore(0.0);
    expect(score).toBe(0);
  });

  it("should handle edge case: negative Sharpe", () => {
    const score = computeBacktestScore(-1.0);
    expect(score).toBe(0);
  });

});
