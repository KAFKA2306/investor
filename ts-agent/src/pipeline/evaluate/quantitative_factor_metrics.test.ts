import { expect, test, describe } from "bun:test";
import { QuantMetrics } from "./quantitative_factor_metrics.ts";

describe("QuantMetrics Standardization Test", () => {
  test("calculateRMSE should return correct value", () => {
    const actuals = [10, 20, 30];
    const predictions = [12, 18, 33];
    // mse = (4 + 4 + 9) / 3 = 17/3 = 5.66
    // rmse = sqrt(5.66) = 2.38
    const rmse = QuantMetrics.calculateRMSE(actuals, predictions);
    expect(rmse).toBeCloseTo(2.38, 2);
  });

  test("calculateSMAPE should return correct value", () => {
    const actuals = [100, 200];
    const predictions = [110, 190];
    // |110-100| / ((110+100)/2) = 10 / 105 = 0.0952
    // |190-200| / ((190+200)/2) = 10 / 195 = 0.0512
    // avg = (0.095238 + 0.051282) / 2 = 0.07326
    // smape = 7.33%
    const smape = QuantMetrics.calculateSMAPE(actuals, predictions);
    expect(smape).toBeCloseTo(7.33, 2);
  });

  test("calculateDA should return 100% for perfect direction", () => {
    const actuals = [110, 120, 115];
    const predictions = [105, 125, 110];
    const previous = [100, 110, 120];
    // act: up, up, down
    // pred: up, up, down
    const da = QuantMetrics.calculateDA(actuals, predictions, previous);
    expect(da).toBe(100);
  });

  test("calculateCorr should match simple pearson when ranked", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const corr = QuantMetrics.calculateCorr(x, y);
    expect(corr).toBeGreaterThan(0.9);
  });

  test("mean should be correct", () => {
    expect(QuantMetrics.mean([1, 2, 3, 4, 5])).toBe(3);
  });
});
