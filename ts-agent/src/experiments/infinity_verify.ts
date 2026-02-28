import { LesAgent } from "../agents/les";

async function main() {
  console.log("🛰 Infinity Architecture Validation (Gen 3: Investor Mode)");
  console.log("-------------------------------------------------------");

  const agent = new LesAgent();

  // 1. Generate a batch (Alpha Factory)
  // We generate 20 to test correlation pruning
  const factors = await agent.generateAlphaFactors({ count: 20 });
  console.log(`✅ Generated ${factors.length} candidates.`);

  // 2. Prepare Sample Market Data (Multi-date for Time-series metrics)
  const marketData = [];
  for (let d = 0; d < 10; d++) {
    const date = `2024-01-${(d + 1).toString().padStart(2, "0")}`;
    for (let i = 0; i < 10; i++) {
      marketData.push({
        symbol: `SYM-${i}`,
        date: date,
        open: 100 + Math.random() * 10,
        high: 115,
        low: 95,
        close: 105 + Math.random() * 10,
        volume: 1000000 * Math.random(),
        turnover_value: 100000000 * Math.random(),
      });
    }
  }

  // 3. Evaluate via Giga-Bridge (Arrow IPC)
  console.log("⏱ Starting Giga-Bridge transfer...");
  const start = Date.now();
  const response = (await agent.evaluateFactorsViaEngine(
    factors,
    marketData,
  )) as {
    // biome-ignore lint/suspicious/noExplicitAny: verification response narrowing
    results: any[];
  };
  const end = Date.now();

  console.log(`✅ Evaluation Completed in ${end - start}ms.`);

  const results = response.results || [];

  console.log(`📊 Results: ${results.length} factors processed.`);

  const successFactors = results.filter((r) => r.status === "success");
  const topFactor = successFactors.sort(
    (a, b) => (b.sharpe || 0) - (a.sharpe || 0),
  )[0];

  if (topFactor) {
    console.log(`🏆 Best Factor: ${topFactor.factor_id}`);
    console.log(`   - IC Proxy: ${topFactor.ic_proxy?.toFixed(4)}`);
    console.log(`   - Sharpe:   ${topFactor.sharpe?.toFixed(2)}`);
    console.log(`   - Max DD:   ${topFactor.max_drawdown?.toFixed(4)}`);
  }

  const redundant = results.filter(
    (r) => r.message === "Redundant factor (high correlation)",
  );
  if (redundant.length > 0) {
    console.log(
      `⚠️ Pruned ${redundant.length} redundant factors (Correlation > 0.95).`,
    );
  }
}

main().catch(console.error);
