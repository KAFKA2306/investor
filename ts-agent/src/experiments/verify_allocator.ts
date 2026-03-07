import { Allocator } from "../compute/allocator.ts";
import { AllocationRequestSchema } from "../schemas/allocation_schema.ts";

/**
 * ✨ Allocator くんの実力をテストするよっ！ ✨
 */
async function verify() {
  console.log("🚀 Starting Allocator Verification...");

  const allocator = new Allocator();

  // Python 版と同じようなテストデータを用意するよっ！
  const testData = {
    ideas: [
      {
        ticker: "7203.T", // Toyota
        strategyType: "MEAN_REVERSION",
        confidence: 0.8, // 確実性を上げるよっ！
        expectedReturn: 0.1, // リターンも増やすよっ！
        volatility: 0.05, // リスクは減らすよっ！
        ideaHash: "hash_toyota_001",
      },
      {
        ticker: "9984.T", // SoftBank
        strategyType: "MOMENTUM",
        confidence: 0.7,
        expectedReturn: 0.15,
        volatility: 0.1,
        ideaHash: "hash_softbank_001",
      },
    ],
    totalCapital: 1000000,
    asOfDate: new Date().toISOString(),
  };

  // Zod でバリデーションチェック！🛡️
  const request = AllocationRequestSchema.parse(testData);

  console.log("📋 Request generated and validated.");

  const results = allocator.allocate(request);

  console.log("💰 Allocation Results:");
  results.forEach((r) => {
    console.log(
      `- ${r.ticker}: Weight=${(r.weight * 100).toFixed(2)}%, Amount=${r.amount.toLocaleString()} JPY (${r.reasoning})`,
    );
  });

  // 合計が 100% になっているかチェック！
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  console.log(`\n⚖️ Total Weight: ${(totalWeight * 100).toFixed(2)}%`);

  if (Math.abs(totalWeight - 1.0) < 1e-10) {
    console.log("✅ Verification Successful! (Normalization check passed)");
  } else {
    console.error("❌ Verification Failed! (Normalization error)");
    throw new Error("Verification Failed");
  }
}

verify().catch((e) => {
  console.error(`❌ Verification Error: ${e.message}`);
  throw e;
});
