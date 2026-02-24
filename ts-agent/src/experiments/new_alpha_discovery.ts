import { LesAgent } from "../agents/les.ts";
import { MarketdataLocalGateway } from "../gateways/marketdata_local_gateway.ts";

const Universe = ["7203", "9984", "8035"];

async function discoverNewAlpha() {
  console.log("🌟 Starting New Alpha Discovery Experiment...");
  console.log("Context Isolation Mode: BLIND PLANNING");

  const agent = new LesAgent();
  const gateway = await MarketdataLocalGateway.create(Universe);
  const date = await gateway.getMarketDataEndDate();
  console.log(`Experimenting with market data up to: ${date}`);

  // 1. Generation with Blind Planning
  // This simulates the agent being forced to think "from scratch"
  const factors = await agent.generateAlphaFactors({
    blindPlanning: true,
    targetDiversity: "HIGH",
  });

  console.log(`\n🔍 Found ${factors.length} potential Alpha Factors:`);
  factors.forEach((f) => {
    console.log(`- [${f.id}] ${f.description}`);
    console.log(`  Reasoning: ${f.reasoning}`);
  });

  // 2. Isolated Evaluation
  console.log("\n⚖️ Evaluating Factors in isolation (Anti-Success Bias)...");
  const evaluations = await Promise.all(
    factors.map(async (f) => {
      const fra = await agent.evaluateReliability(f);
      const rpa = await agent.evaluateRisk(f);
      return { f, fra, rpa, score: (fra.rs + rpa.rs) / 2 };
    }),
  );

  evaluations.forEach(({ f, fra, rpa, score }) => {
    console.log(`\nFactor: ${f.id}`);
    console.log(`- Total Score: ${score.toFixed(2)}`);
    console.log(
      `- FRA Status: ${fra.rs > 0.7 ? "PASS" : "FAIL"} (${fra.logic})`,
    );
    if (fra.rejectionReason)
      console.log(`  ⚠️ REJECTED: ${fra.rejectionReason}`);
    console.log(
      `- RPA Status: ${rpa.rs > 0.7 ? "PASS" : "FAIL"} (${rpa.logic})`,
    );
  });

  const highQualityAlpha = evaluations.filter((e) => e.score > 0.75);
  console.log(
    `\n✨ Discovery Complete. ${highQualityAlpha.length} factors identified as Production Ready.`,
  );
}

discoverNewAlpha().catch(console.error);
