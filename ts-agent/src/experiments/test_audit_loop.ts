import { SelfCriticizeLoop } from "../use_cases/self_criticize_loop.ts";

async function testAuditLoop() {
  console.log("🚀 Testing Self-Criticize Loop...");

  const loop = new SelfCriticizeLoop();
  const finalReport = await loop.run("STRAT-LOOP-TEST", 3);

  console.log("\nFinal Audit Report from Loop:");
  console.log("Verdict:", finalReport.verdict);
  console.log("Final Critique Count:", finalReport.critique.length);
  console.log("Production Ready:", finalReport.isProductionReady);
}

testAuditLoop().catch(console.error);
