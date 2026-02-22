import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { core } from "./core/index.ts";

export { core as Core };

export async function runParallel(task: () => Promise<void>): Promise<void> {
  const { Orchestrator } = await import("./core/orchestrator.ts");
  const orchestrator = new Orchestrator();
  await orchestrator.runParallel(task);
}

export function writeDailyLog(data: Record<string, unknown>): void {
  const logsBase = core.config.paths.logs;
  const logsDir = join(logsBase, "daily");
  mkdirSync(logsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const logPath = join(logsDir, `${date}.json`);
  writeFileSync(logPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Daily log written to ${logPath}`);
}
