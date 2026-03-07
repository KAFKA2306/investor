import { describe, it, expect } from "bun:test";
import { computeConstraintScore, type BacktestMetrics } from "../../../src/agents/metrics/constraint_scorer";

describe("computeConstraintScore", () => {
  it("should return 1.0 when all constraints passed", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      maxDrawdown: 0.08,
    };
    expect(computeConstraintScore(metrics)).toBe(1.0);
  });

  it("should return 1.0 when metrics exactly meet thresholds", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.5,
      maxDrawdown: 0.1,
    };
    expect(computeConstraintScore(metrics)).toBe(1.0);
  });

  it("should return partial score when one constraint fails (Sharpe)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.2,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return partial score when one constraint fails (MaxDD)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      maxDrawdown: 0.15,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return partial score when both constraints fail", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.2,
      maxDrawdown: 0.15,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return low score for multiple failures", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.5,
      maxDrawdown: 0.15,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return very low score when all constraints fail severely", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.5,
      maxDrawdown: 0.2,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThanOrEqual(0.4);
  });

  it("should handle edge case: very high Sharpe with other failures", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 10.0,
      maxDrawdown: 0.2,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should handle edge case: zero values", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.0,
      maxDrawdown: 0.0,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge case: negative Sharpe (crisis scenario)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: -1.0,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should handle edge case: very high maxDrawdown", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      maxDrawdown: 0.5,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return proportional scores: 2/2 > 1/2 > 0/2", () => {
    const allPass: BacktestMetrics = {
      sharpeRatio: 2.0,
      maxDrawdown: 0.08,
    };
    const onePass: BacktestMetrics = {
      sharpeRatio: 2.0,
      maxDrawdown: 0.15,
    };
    const nonePass: BacktestMetrics = {
      sharpeRatio: 0.5,
      maxDrawdown: 0.15,
    };

    const scoreAllPass = computeConstraintScore(allPass);
    const scoreOnePass = computeConstraintScore(onePass);
    const scoreNonePass = computeConstraintScore(nonePass);

    expect(scoreAllPass).toBe(1.0);
    expect(scoreOnePass).toBeLessThan(scoreAllPass);
    expect(scoreNonePass).toBeLessThan(scoreOnePass);
  });
});
