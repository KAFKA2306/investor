import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import type { UnifiedLog } from "../schemas/log.ts";
import { UnifiedLogSchema } from "../schemas/log.ts";

const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
  }),
  paths: z.object({
    data: z.string(),
    logs: z.string(),
  }),
  providers: z.object({
    yfinance: z.object({ enabled: z.boolean() }),
    jquants: z.object({
      enabled: z.boolean(),
      apiKey: z.string().optional(),
    }),
    edinet: z.object({ enabled: z.boolean() }),
    estat: z.object({ enabled: z.boolean() }),
    ai: z.object({ enabled: z.boolean() }),
  }),
  benchmark: z.object({
    foundation: z.object({
      noiseThresholdMultiplier: z.number().positive(),
      overconfidenceThreshold: z.number().min(0).max(1),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

class Core {
  public readonly config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const configPath = join(import.meta.dir, "..", "config", "default.yaml");
    const configDir = dirname(configPath);
    const fileContents = readFileSync(configPath, "utf8");
    const data = yaml.load(fileContents);
    const result = ConfigSchema.safeParse(data);

    if (!result.success) {
      process.exit(1);
    }

    return {
      ...result.data,
      paths: {
        data: isAbsolute(result.data.paths.data)
          ? result.data.paths.data
          : resolve(configDir, result.data.paths.data),
        logs: isAbsolute(result.data.paths.logs)
          ? result.data.paths.logs
          : resolve(configDir, result.data.paths.logs),
      },
    };
  }

  public getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      process.exit(1);
    }
    return value;
  }
}

export abstract class BaseAgent {
  protected readonly core = core;
  constructor() {
    if (!this.core.config.project.name) {
      process.exit(1);
    }
  }
  public abstract run(): Promise<void>;
}

export const core = new Core();

function createLogPath(date: string): string {
  const logsBase = core.config.paths.logs;
  const logsDir = join(logsBase, "daily");
  mkdirSync(logsDir, { recursive: true });
  return join(logsDir, `${date}.json`);
}

export function writeDailyLog(data: UnifiedLog): void {
  const validated = UnifiedLogSchema.parse(data);
  const logPath = createLogPath(validated.report.date);
  writeFileSync(logPath, JSON.stringify(validated, null, 2), "utf8");
  console.log(`Unified daily log written to ${logPath}`);
}

export function readDailyLog(date: string): UnifiedLog {
  const logPath = createLogPath(date);
  const content = readFileSync(logPath, "utf8");
  return UnifiedLogSchema.parse(JSON.parse(content) as unknown);
}

export async function runParallel(task: () => Promise<void>): Promise<void> {
  const { Orchestrator } = await import("./orchestrator.ts");
  const orchestrator = new Orchestrator();
  await orchestrator.runParallel(task);
}

export { core as Core };
