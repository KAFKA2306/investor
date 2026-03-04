import { describe, it, expect } from "bun:test";
import type { StandardVerificationData } from "../../src/dashboard/src/dashboard_core";
import { evaluateAlphaValidation } from "../../src/dashboard/src/utils/alpha_validation";

describe("Alpha Validation Logic", () => {
  const mockVerificationData: StandardVerificationData = {
    schemaVersion: "1.0",
    strategyId: "ALPHA-FUNDAMENTAL-3D2C1330",
    strategyName: "Fundamental Alpha Strategy",
    description: "Test alpha strategy",
    generatedAt: new Date().toISOString(),
    audit: {
      commitHash: "abc123",
      environment: "test",
      runId: "run-123",
      dataFingerprint: "fp-123",
    },
    dates: ["20260101", "20260102"],
    strategyCum: [1.0, 1.006],
    benchmarkCum: [1.0, 1.002],
    fileName: "test.json",
    metrics: {
      sharpe: 0.396,
      ic: 0.0,
      maxDD: 1.0, // 100%
      totalReturn: 0.006, // 0.6%
      universe: ["9984", "9983"],
    },
  };

  it("should evaluate Sharpe Ratio as FAIL when below 1.8 threshold", () => {
    const result = evaluateAlphaValidation(mockVerificationData);

    expect(result.sharpeStatus).toBe("FAIL");
    expect(result.sharpeThreshold).toBe(1.8);
  });

  it("should evaluate IC as FAIL when below 0.04 threshold", () => {
    const result = evaluateAlphaValidation(mockVerificationData);

    expect(result.icStatus).toBe("FAIL");
    expect(result.icThreshold).toBe(0.04);
  });

  it("should evaluate Max Drawdown as FAIL when above 0.10 threshold", () => {
    const result = evaluateAlphaValidation(mockVerificationData);

    expect(result.maxDdStatus).toBe("FAIL");
    expect(result.maxDdThreshold).toBe(0.1);
  });

  it("should evaluate overall validation as FAIL when any metric fails", () => {
    const result = evaluateAlphaValidation(mockVerificationData);

    expect(result.overallStatus).toBe("FAIL");
    expect(result.failedMetrics.length).toBeGreaterThan(0);
  });

  it("should provide failure messages for failed metrics", () => {
    const result = evaluateAlphaValidation(mockVerificationData);

    expect(result.failureMessages.length).toBeGreaterThan(0);
    expect(result.failureMessages[0]).toMatch(/Sharpe|IC|Drawdown/);
  });

  it("should evaluate all metrics as PASS when within thresholds", () => {
    const passingData: StandardVerificationData = {
      ...mockVerificationData,
      metrics: {
        ...mockVerificationData.metrics!,
        sharpe: 2.0, // Above 1.8
        ic: 0.05, // Above 0.04
        maxDD: 0.08, // Below 0.10
        totalReturn: 0.15, // 15%
      },
    };

    const result = evaluateAlphaValidation(passingData);

    expect(result.sharpeStatus).toBe("PASS");
    expect(result.icStatus).toBe("PASS");
    expect(result.maxDdStatus).toBe("PASS");
    expect(result.overallStatus).toBe("PASS");
  });

  it("should handle missing metrics gracefully", () => {
    const incompleteData: StandardVerificationData = {
      ...mockVerificationData,
      metrics: {
        totalReturn: 0.006,
      },
    };

    const result = evaluateAlphaValidation(incompleteData);

    expect(result.overallStatus).toBe("FAIL");
    expect(result.failedMetrics).toContain("sharpe");
    expect(result.failedMetrics).toContain("ic");
  });
});
