import { ContextPlaybook } from "../context/playbook.ts";

async function curate() {
  const playbook = new ContextPlaybook();
  await playbook.load();

  console.log("📝 Curating successful Alpha Factors into Playbook...");

  playbook.addBullet({
    content:
      "INTRA_RANGE_POS Factor: Measures close relative to high-low range. (Close - Low) / (High - Low). Captures end-of-day buy pressure.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscoveryStep1",
      type: "HYPOTHESIS",
      performance: { sharpe: 7.6, returnUplift: 0.0057 },
      reasoning: "Orthogonal to momentum; catches intra-day trend persistence.",
    },
  });

  playbook.addBullet({
    content:
      "OP_MARGIN Factor: Operating Profit / Net Sales. Serves as a quality-based buffer against purely speculative price movements.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscoveryStep1",
      type: "HYPOTHESIS",
      performance: { sharpe: 7.6, returnUplift: 0.0057 },
      reasoning:
        "Fundamental quality anchor to filter noise in high-volatility regimes.",
    },
  });

  await playbook.save();
  console.log("✅ Playbook updated with curated Alpha Factors.");
}

curate().catch(console.error);
