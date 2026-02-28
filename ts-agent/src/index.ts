import { core } from "./system/app_runtime_core.ts";
import type { PipelineRequirement } from "./system/pipeline_orchestrator.ts";
import {
  DataEngineerBridge,
  ElderBridge,
  ExecutionAgentBridge,
  PipelineOrchestrator,
  QuantResearcherBridge,
  StateMonitorBridge,
} from "./system/pipeline_orchestrator.ts";

async function main() {
  console.log("Starting Autonomous Quant Alpha Pipeline");

  const args = process.argv.slice(2);
  const defaultRequirement =
    "Discover high-Sharpe alpha factors in the current market regime with low drawdown.";
  const userRequirement = args.join(" ") || defaultRequirement;

  const requirement: PipelineRequirement = {
    id: `REQ-${Date.now()}`,
    description: userRequirement,
    universe: core.config.universe.symbols,
    targetMetrics: {
      minSharpe: 1.5,
      minIC: 0.03,
      maxDrawdown: 0.1,
      dataDelivery: {
        minQualityScore: 0.82,
        minCoverageRate: 0.8,
        maxMissingRate: 0.08,
        minLatencyScore: 0.7,
        minLeakFreeScore: 1,
        minSourceConsistency: 0.88,
      },
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
