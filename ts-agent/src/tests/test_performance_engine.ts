import { evaluate } from "../domain/performance.ts";
import type { DailyLog } from "../schemas/performance_schema.ts";

function assertApprox(actual: number, expected: number, msg: string) {
  if (Math.abs(actual - expected) > 1e-4) {
    throw new Error(`${msg}: expected ~${expected}, got ${actual}`);
  }
}

console.log("Running Performance Engine Verification...");

// 1. Constant Positive Return (0.1% daily)
const logs1: DailyLog[] = Array.from({ length: 365 }, (_, i) => ({
  date: `202601${String(i).padStart(2, "0")}`,
  strategyReturn: 0.001,
}));

const res1 = evaluate(logs1);
console.log("Test 1 (Constant 0.1%):", res1);
assertApprox(res1.avgReturn, 0.001, "Avg Return");
assertApprox(res1.volatility, 0, "Volatility");
assertApprox(res1.cumulativeReturn, 1.001 ** 365 - 1, "Cumulative");
assertApprox(res1.cagr, 1.001 ** 365 - 1, "CAGR");

// 2. Volatile Sequence with Drawdown
// Case: 10% up, then 20% down, then 10% up
const logs2: DailyLog[] = [
  { date: "20260101", strategyReturn: 0.1 },
  { date: "20260102", strategyReturn: -0.21 }, // 1.1 * 0.79 = 0.869
  { date: "20260103", strategyReturn: 0.1 }, // 0.869 * 1.1 = 0.9559
];
const res2 = evaluate(logs2);
console.log("Test 2 (Volatile):", res2);
// MaxDD: peak at 1.1, bottom at 0.869. DD = (0.869 - 1.1)/1.1 = -0.21
assertApprox(res2.maxDrawdown, -0.21, "Max Drawdown");

// 3. Information Ratio (Benchmark Comparison)
const logs3: DailyLog[] = [
  { date: "20260101", strategyReturn: 0.02, benchmarkReturn: 0.01 }, // Diff 0.01
  { date: "20260102", strategyReturn: 0.03, benchmarkReturn: 0.02 }, // Diff 0.01
];
const res3 = evaluate(logs3);
console.log("Test 3 (IR):", res3);
assertApprox(res3.informationRatio ?? 0, 0, "IR (Zero variance diff)"); // Vol of [0.01, 0.01] is 0

console.log("\n✅ PERFORMANCE ENGINE VERIFIED SUCCESSFULLY.");
