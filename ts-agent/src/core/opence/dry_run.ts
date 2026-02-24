import {
  AceAcquirer,
  AceConstructor,
  AceEvaluator,
  AceEvolver,
  AceProcessor,
} from "../../agents/ace_agents";
import type { UnifiedLog } from "../../schemas/log";
import { ContextPlaybook } from "../playbook";
import { ClosedLoopOrchestrator } from "./orchestrator";

interface OrchestratorResult {
  prompt: string;
  evaluation: {
    score: number;
    feedback: string[];
    metadata: Record<string, unknown>;
  };
}

async function runDryRun() {
  console.log("🚀 Starting OpenCE Phase 1 Dry-Run...");

  const playbook = new ContextPlaybook();
  await playbook.load();

  const acquirer = new AceAcquirer();
  const processor = new AceProcessor();
  const constructor_ = new AceConstructor();
  const evaluator = new AceEvaluator();
  const evolver = new AceEvolver(playbook);

  const orchestrator = new ClosedLoopOrchestrator(
    acquirer,
    processor,
    constructor_,
    evaluator,
    evolver,
  );

  // Simulated UnifiedLog
  const dummyLog = {
    schema: "investor.daily-log.v1",
    timestamp: new Date().toISOString(),
    agent: "LesAgent",
    report: {
      results: {
        backtest: {
          sharpe: 2.1,
        },
      },
      analysis: "Test Analysis",
    },
  } as unknown as UnifiedLog;

  const result = (await orchestrator.run(dummyLog)) as OrchestratorResult;

  console.log("\n--- Dry-Run Result ---");
  console.log("Prompt preview:", `${result.prompt.substring(0, 100)}...`);
  console.log("Evaluation Score:", result.evaluation.score);
  console.log("Feedback:", result.evaluation.feedback);
  console.log("----------------------");

  console.log("✨ Dry-Run Complete!");
}

runDryRun().catch(console.error);
