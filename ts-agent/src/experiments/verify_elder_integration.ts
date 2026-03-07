import { MacroTopDownAgent } from "../agents/macro_top_down_agent.ts";
import { ElderBridge } from "../system/pipeline_orchestrator.ts";
import { logger } from "../utils/logger.ts";

async function verify() {
  logger.info("🧪 Starting Integration Verification...");

  // 1. マクロエージェントを走らせてイベントを発行させるよっ！
  const agent = new MacroTopDownAgent();
  await agent.run();

  // 2. ElderBridge がそのイベントを「知識」として集められるかチェック！
  const elder = new ElderBridge();
  const history = await elder.getHistory("integration-test");

  console.log(
    "\n--- Elder History (Total Knowledge: " +
      history.knowledge.length +
      ") ---",
  );
  history.knowledge.forEach((k, i) => {
    console.log(`${i + 1}: ${k}`);
  });

  const found = history.knowledge.some((k) =>
    k.includes("[MacroTopDownAgent]"),
  );
  if (found) {
    console.log(
      "\n✅ Success! Elite analyst insights are now part of the Elder's knowledge pool! 🚀💎",
    );
  } else {
    console.log(
      "\n❌ Failed. Analyst insights were not found in Elder's history. 😡",
    );
  }
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});
