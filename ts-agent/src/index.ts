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

  const orchestrator = new PipelineOrchestrator(
    new ElderBridge(),
    new DataEngineerBridge(),
    new QuantResearcherBridge(),
    new ExecutionAgentBridge(),
    new StateMonitorBridge(),
  );

  await orchestrator.run();
  console.log("Autonomous Alpha Evolution Loop cycle completed");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`❌ Fatal Error: ${e.message}`);
    process.exit(1);
  });
}
