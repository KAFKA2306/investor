import { describe, it, expect } from "bun:test";
import { computeConstraintScore, type BacktestMetrics } from "../../../src/agents/metrics/constraint_scorer";

describe("computeConstraintScore", () => {
  it("should return 1.0 when all constraints passed", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };
    expect(computeConstraintScore(metrics)).toBe(1.0);
  });

  it("should return 1.0 when metrics exactly meet thresholds", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.5,
      informationCoefficient: 0.04,
      maxDrawdown: 0.1,
    };
    expect(computeConstraintScore(metrics)).toBe(1.0);
  });

  it("should return partial score when one constraint fails (Sharpe)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.2,
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return partial score when one constraint fails (IC)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.02,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return partial score when one constraint fails (MaxDD)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.15,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return partial score when two constraints fail", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 1.2,
      informationCoefficient: 0.02,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return low score for multiple failures", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.5,
      informationCoefficient: 0.01,
      maxDrawdown: 0.15,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThanOrEqual(0.5);
  });

  it("should return very low score when all constraints fail severely", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.5,
      informationCoefficient: 0.01,
      maxDrawdown: 0.2,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThanOrEqual(0.25);
  });

  it("should handle edge case: very high Sharpe with other failures", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 10.0,
      informationCoefficient: 0.01,
      maxDrawdown: 0.2,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should handle edge case: zero values", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 0.0,
      informationCoefficient: 0.0,
      maxDrawdown: 0.0,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge case: negative Sharpe (crisis scenario)", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: -1.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should handle edge case: very high maxDrawdown", () => {
    const metrics: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.5,
    };
    const score = computeConstraintScore(metrics);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0.0);
  });

  it("should return proportional scores: 3/3 > 2/3 > 1/3 > 0/3", () => {
    const allPass: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.08,
    };
    const twoPass: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.05,
      maxDrawdown: 0.15,
    };
    const onePass: BacktestMetrics = {
      sharpeRatio: 2.0,
      informationCoefficient: 0.01,
      maxDrawdown: 0.15,
    };
    const noneFail: BacktestMetrics = {
      sharpeRatio: 0.5,
      informationCoefficient: 0.01,
      maxDrawdown: 0.15,
    };

    const scoreAllPass = computeConstraintScore(allPass);
    const scoreTwoPass = computeConstraintScore(twoPass);
    const scoreOnePass = computeConstraintScore(onePass);
    const scoreNoneFail = computeConstraintScore(noneFail);

    expect(scoreAllPass).toBe(1.0);
    expect(scoreTwoPass).toBeGreaterThan(scoreOnePass);
    expect(scoreOnePass).toBeGreaterThan(scoreNoneFail);
  });
});
