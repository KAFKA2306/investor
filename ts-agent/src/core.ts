import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { core } from "./core/index.ts";
import type { UnifiedLog } from "./schemas/log.ts";
import { UnifiedLogSchema } from "./schemas/log.ts";

export { core as Core };

export async function runParallel(task: () => Promise<void>): Promise<void> {
  const { Orchestrator } = await import("./core/orchestrator.ts");
  const orchestrator = new Orchestrator();
  await orchestrator.runParallel(task);
}

function createLogPath(date: string): string {
  const logsBase = core.config.paths.logs;
  const logsDir = join(logsBase, "daily");
  mkdirSync(logsDir, { recursive: true });
  return join(logsDir, `${date}.json`);
}

export function writeDailyLog(data: UnifiedLog): void {
  const validated = UnifiedLogSchema.parse(data);
  const logPath = createLogPath(validated.date);
  writeFileSync(logPath, JSON.stringify(validated, null, 2), "utf8");
  console.log(`Unified daily log written to ${logPath}`);
}

export function readDailyLog(date: string): UnifiedLog | undefined {
  const logPath = createLogPath(date);
  return existsSync(logPath)
    ? ((content) => {
        const parsed = UnifiedLogSchema.safeParse(
          JSON.parse(content) as unknown,
        );
        return parsed.success ? parsed.data : undefined;
      })(readFileSync(logPath, "utf8"))
    : undefined;
}
