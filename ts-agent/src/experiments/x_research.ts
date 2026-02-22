import { XIntelligenceAgent } from "../agents/x_intelligence.ts";
import { Orchestrator } from "../core/orchestrator.ts";

async function verifyXResearch() {
  const xAgent = new XIntelligenceAgent();
  const orchestrator = new Orchestrator();

  console.log("Starting Real-time X Research Experiment... 🚀");

  await orchestrator.runParallel(async () => {
    const signals = await xAgent.searchMarketAlpha();
    for (const signal of signals) {
      console.log(
        `[X-ALPHA] Found signal for ${signal.symbol} with sentiment ${signal.sentiment} ✨`,
      );
    }
  });
}

if (import.meta.main) {
  await verifyXResearch();
}
