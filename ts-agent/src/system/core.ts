import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { EventStore } from "../context/event_store.ts";
import { MemoryCenter } from "../context/memory_center.ts";
import { MarketdataDbCache } from "../providers/marketdata_db.ts";
import { SqliteHttpCache } from "../providers/sqlite_http_cache.ts";
import type { UnifiedLog } from "../schemas/log.ts";
import {
  type BenchmarkReportSchema,
  type DailyScenarioLogSchema,
  type ReadinessReportSchema,
  UnifiedLogSchema,
} from "../schemas/log.ts";
import type { StandardOutcomeSchema } from "../schemas/outcome.ts";
import type { EventType } from "./uqtl.ts";

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
    python: z
      .object({
        uvPath: z.string().optional(),
        venvDir: z.string().optional(),
      })
      .optional(),
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
  public readonly cache: SqliteHttpCache;
  public readonly db: MarketdataDbCache;
  public readonly eventStore: EventStore;

  constructor() {
    this.config = this.loadConfig();
    this.cache = new SqliteHttpCache(
      join(this.config.paths.logs, "cache", "http_cache.sqlite"),
    );
    this.db = new MarketdataDbCache(
      this.config.paths.data,
      join(this.config.paths.logs, "cache", "market_cache.sqlite"),
    );
    this.eventStore = new EventStore(
      join(this.config.paths.logs, "cache", "uqtl.sqlite"),
    );
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

  public getVenvPythonPath(): string {
    const venvDir =
      this.config.providers.python?.venvDir ||
      join(import.meta.dir, "..", "..", ".venv");
    return join(venvDir, "bin", "python");
  }

  public getUvPath(): string {
    return this.config.providers.python?.uvPath || "uv";
  }
}

export abstract class BaseAgent {
  protected readonly core = core;
  constructor() {
    if (!this.core.config.project.name) {
      process.exit(1);
    }
  }

  public emitEvent(
    type: EventType,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const event = {
      id,
      timestamp,
      type,
      agentId: this.constructor.name,
      payload,
      metadata,
    };

    core.eventStore.appendEvent(event);

    // Mirror events to MemoryCenter so dashboard/API lineage checks can bind to the same run.
    const memory = new MemoryCenter();
    try {
      memory.pushEvent(event);
    } finally {
      memory.close();
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
  let dateStr = "";

  if (validated.schema === "investor.daily-log.v1") {
    dateStr = (validated.report as z.infer<typeof DailyScenarioLogSchema>).date;
  } else if (validated.schema === "investor.benchmark-log.v1") {
    dateStr = (validated.report as z.infer<typeof BenchmarkReportSchema>).date;
  } else if (validated.schema === "investor.readiness-report.v1") {
    dateStr = (validated.report as z.infer<typeof ReadinessReportSchema>)
      .dateRange.to;
  } else if (validated.schema === "investor.investment-outcome.v1") {
    dateStr = (
      validated.report as z.infer<typeof StandardOutcomeSchema>
    ).timestamp
      .split("T")[0]
      ?.replaceAll("-", "") as string;
  }

  if (!dateStr) {
    dateStr = new Date().toISOString().split("T")[0]?.replaceAll("-", "") || "";
  }

  const logPath = createLogPath(dateStr);
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
export const eventStore = core.eventStore;
