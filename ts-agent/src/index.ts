import { PipelineOrchestrator } from "./system/pipeline_orchestrator.ts";
import { ElderBridge, DataEngineerBridge, QuantResearcherBridge, ExecutionAgentBridge } from "./system/pipeline_roles_bridge.ts";
import { type PipelineRequirement } from "./system/pipeline_types.ts";
import { core } from "./system/app_runtime_core.ts";

async function main() {
  console.log("🌟 Starting Autonomous Quant Alpha Pipeline 🌟");
  
  const requirement: PipelineRequirement = {
    id: `REQ-${Date.now()}`,
    description: "Discover high-Sharpe alpha factors in the current market regime with low drawdown.",
    universe: core.config.universe.symbols,
    targetMetrics: {
      minSharpe: 1.5,
      minIC: 0.03,
      maxDrawdown: 0.1
    }
  };

  const orchestrator = new PipelineOrchestrator(
    new ElderBridge(),
    new DataEngineerBridge(),
    new QuantResearcherBridge(),
    new ExecutionAgentBridge()
  );

  try {
    await orchestrator.runPipeline(requirement);
    console.log("✨ Pipeline execution completed successfully. ✨");
  } catch (error) {
    console.error("❌ Pipeline failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
