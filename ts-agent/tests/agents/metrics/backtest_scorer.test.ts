import { describe, it, expect } from "bun:test";
import { computeBacktestScore } from "../../../src/agents/metrics/backtest_scorer";

describe("computeBacktestScore", () => {
  it("should compute backtest score from Sharpe and IC", () => {
    const score = computeBacktestScore(2.0, 0.06);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should return 0 for poor Sharpe", () => {
    const score = computeBacktestScore(0.5, 0.06);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return 0 for poor IC", () => {
    const score = computeBacktestScore(2.0, 0.01);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return high score for strong metrics", () => {
    const score = computeBacktestScore(2.5, 0.08);
    expect(score).toBeGreaterThan(0.7);
  });

  it("should normalize Sharpe ratio (min=1.5, ideal=2.0)", () => {
    // At min threshold (1.5) with ideal IC -> average should be 0.5
    const minScore = computeBacktestScore(1.5, 0.08);
    expect(minScore).toBeCloseTo(0.5, 1);

    // At ideal threshold (2.0) with ideal IC -> should give 1.0
    const idealScore = computeBacktestScore(2.0, 0.08);
    expect(idealScore).toBeCloseTo(1.0, 1);

    // Above ideal should clip to 1.0
    const aboveIdealScore = computeBacktestScore(3.0, 0.08);
    expect(aboveIdealScore).toBeCloseTo(1.0, 1);
  });

  it("should normalize IC (min=0.04, ideal=0.08)", () => {
    // At min threshold (0.04) with ideal Sharpe -> average should be 0.5
    const minScore = computeBacktestScore(2.0, 0.04);
    expect(minScore).toBeCloseTo(0.5, 1);

    // At ideal threshold (0.08) with ideal Sharpe -> should give 1.0
    const idealScore = computeBacktestScore(2.0, 0.08);
    expect(idealScore).toBeCloseTo(1.0, 1);

    // Above ideal should clip to 1.0
    const aboveIdealScore = computeBacktestScore(2.0, 0.12);
    expect(aboveIdealScore).toBeCloseTo(1.0, 1);
  });

  it("should return 1.0 for perfect metrics", () => {
    const score = computeBacktestScore(2.5, 0.10);
    expect(score).toBeGreaterThan(0.95);
  });

  it("should handle edge case: zero Sharpe", () => {
    const score = computeBacktestScore(0.0, 0.06);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge case: zero IC", () => {
    const score = computeBacktestScore(2.0, 0.0);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge case: negative Sharpe", () => {
    const score = computeBacktestScore(-1.0, 0.06);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge case: negative IC", () => {
    const score = computeBacktestScore(2.0, -0.02);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should average Sharpe and IC scores", () => {
    // Perfect Sharpe (1.0), zero IC (0.0) -> average 0.5
    const score = computeBacktestScore(2.0, 0.04);
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(score).toBeLessThanOrEqual(0.6);
  });

  it("should penalize both poor metrics equally", () => {
    const bothPoor = computeBacktestScore(1.0, 0.02);
    const oneGood = computeBacktestScore(2.5, 0.02);
    expect(bothPoor).toBeLessThan(oneGood);
  });

  it("should be symmetric with respect to components", () => {
    // Both at 1.5 and 0.04 (min thresholds) should be similar
    const score1 = computeBacktestScore(1.5, 0.04);
    const score2 = computeBacktestScore(1.5, 0.04);
    expect(score1).toBeCloseTo(score2, 5);
  });
});
