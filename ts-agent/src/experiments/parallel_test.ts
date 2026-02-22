import { Orchestrator } from "../core/orchestrator.ts";

async function testParallelAgents() {
  const orchestrator = new Orchestrator();

  await orchestrator.runParallel(async () => {
    // Simulate a market research task
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

if (import.meta.main) {
  console.log("Starting Parallel Agents Experiment... 🚀");
  await testParallelAgents();
}
