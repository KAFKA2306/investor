import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";
import { core } from "../system/app_runtime_core.ts";

const Universe = core.config.universe.symbols;

/**
 * Playbook Curation Logic
 */
export async function curateAlphaPlaybook() {
  const playbook = new ContextPlaybook();
  await playbook.load();
  console.log("📝 Curating successful Alpha Factors into Playbook...");
  playbook.addBullet({
    content:
      "INTRA_RANGE_POS Factor: (Close - Low) / (High - Low). Captures end-of-day buy pressure.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscovery",
      type: "HYPOTHESIS",
      performance: { sharpe: 7.6, returnUplift: 0.0057 },
    },
  });
  playbook.addBullet({
    content:
      "OP_MARGIN Factor: Operating Profit / Net Sales. Serves as a quality-based buffer.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscovery",
      type: "HYPOTHESIS",
      performance: { sharpe: 7.6, returnUplift: 0.0057 },
    },
  });
  await playbook.save();
  console.log("✅ Playbook updated.");
}

/**
 * Alpha Factor Discovery Logic
 */
export async function discoverAlphaFactors() {
  const agent = new LesAgent();
  const playbook = new ContextPlaybook();
  await playbook.load();
  console.log(`🚀 Starting Discovery over Universe: ${Universe.join(", ")}`);
  const hypotheses = await agent.generateHypotheses(playbook.getBullets());
  console.log(`Generated ${hypotheses.length} hypotheses.`);
}

if (import.meta.main) {
  if (process.argv.includes("--curate")) {
    curateAlphaPlaybook();
  } else {
    discoverAlphaFactors();
  }
}
