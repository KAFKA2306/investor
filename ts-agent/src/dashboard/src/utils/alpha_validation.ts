import type { StandardVerificationData } from "../dashboard_core";

export interface AlphaValidationResult {
  overallStatus: "PASS" | "FAIL";
  sharpeStatus: "PASS" | "FAIL" | "MISSING";
  icStatus: "PASS" | "FAIL" | "MISSING";
  maxDdStatus: "PASS" | "FAIL" | "MISSING";
  sharpeThreshold: number;
  icThreshold: number;
  maxDdThreshold: number;
  failedMetrics: string[];
  failureMessages: string[];
}

const QUALITY_THRESHOLDS = {
  sharpe: 1.8,
  ic: 0.04,
  maxDD: 0.1, // 10%
};

export function evaluateAlphaValidation(
  data: StandardVerificationData | null,
): AlphaValidationResult {
  const result: AlphaValidationResult = {
    overallStatus: "PASS",
    sharpeStatus: "MISSING",
    icStatus: "MISSING",
    maxDdStatus: "MISSING",
    sharpeThreshold: QUALITY_THRESHOLDS.sharpe,
    icThreshold: QUALITY_THRESHOLDS.ic,
    maxDdThreshold: QUALITY_THRESHOLDS.maxDD,
    failedMetrics: [],
    failureMessages: [],
  };

  if (!data || !data.metrics) {
    result.overallStatus = "FAIL";
    result.failureMessages.push("Verification data or metrics not available");
    result.failedMetrics = ["sharpe", "ic", "maxDD"];
    return result;
  }

  const { sharpe, ic, maxDD } = data.metrics;

  // Evaluate Sharpe Ratio
  if (sharpe !== undefined && sharpe !== null) {
    if (sharpe >= QUALITY_THRESHOLDS.sharpe) {
      result.sharpeStatus = "PASS";
    } else {
      result.sharpeStatus = "FAIL";
      result.failedMetrics.push("sharpe");
      result.failureMessages.push(
        `Sharpe Ratio (${sharpe.toFixed(3)}) is below threshold of ${QUALITY_THRESHOLDS.sharpe}`,
      );
    }
  } else {
    result.sharpeStatus = "MISSING";
    result.failedMetrics.push("sharpe");
    result.failureMessages.push("Sharpe Ratio is missing");
  }

  // Evaluate Information Coefficient
  if (ic !== undefined && ic !== null) {
    if (ic >= QUALITY_THRESHOLDS.ic) {
      result.icStatus = "PASS";
    } else {
      result.icStatus = "FAIL";
      result.failedMetrics.push("ic");
      result.failureMessages.push(
        `Information Coefficient (${ic.toFixed(3)}) is below threshold of ${QUALITY_THRESHOLDS.ic}`,
      );
    }
  } else {
    result.icStatus = "MISSING";
    result.failedMetrics.push("ic");
    result.failureMessages.push("Information Coefficient is missing");
  }

  // Evaluate Max Drawdown
  if (maxDD !== undefined && maxDD !== null) {
    if (maxDD <= QUALITY_THRESHOLDS.maxDD) {
      result.maxDdStatus = "PASS";
    } else {
      result.maxDdStatus = "FAIL";
      result.failedMetrics.push("maxDD");
      result.failureMessages.push(
        `Max Drawdown (${(maxDD * 100).toFixed(1)}%) exceeds threshold of ${QUALITY_THRESHOLDS.maxDD * 100}%`,
      );
    }
  } else {
    result.maxDdStatus = "MISSING";
    result.failedMetrics.push("maxDD");
    result.failureMessages.push("Max Drawdown is missing");
  }

  // Determine overall status
  result.overallStatus = result.failedMetrics.length === 0 ? "PASS" : "FAIL";

  return result;
}
