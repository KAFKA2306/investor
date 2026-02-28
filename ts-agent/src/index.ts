import { core } from "./system/app_runtime_core.ts";
import {
  DataEngineerBridge,
  ElderBridge,
  ExecutionAgentBridge,
  QuantResearcherBridge,
  StateMonitorBridge,
} from "./system/pipeline_roles_bridge.ts";
import { PipelineOrchestrator } from "./system/pipeline_orchestrator.ts";
import type { PipelineRequirement } from "./system/pipeline_types.ts";

async function main() {
  console.log("Starting Autonomous Quant Alpha Pipeline");

  const args = process.argv.slice(2);
  const userRequirement =
    args.length > 0
      ? args.join(" ")
      : "Discover high-Sharpe alpha factors in the current market regime with low drawdown.";

  const requirement: PipelineRequirement = {
    id: `REQ-${Date.now()}`,
    description: userRequirement,
    universe: core.config.universe.symbols,
    targetMetrics: {
      minSharpe: 1.5,
      minIC: 0.03,
      maxDrawdown: 0.1,
    },
  };

  const orchestrator = new PipelineOrchestrator(
    new ElderBridge(),
    new DataEngineerBridge(),
    new QuantResearcherBridge(),
    new ExecutionAgentBridge(),
    new StateMonitorBridge(),
  );

  await orchestrator.runPipeline(requirement);
  console.log("Pipeline execution completed");
}

import.meta.main && void main();
