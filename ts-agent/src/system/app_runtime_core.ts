import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import {
  EventStore,
  MemoryCenter,
} from "../context/unified_context_services.ts";
import {
  MarketdataDbCache,
  SqliteHttpCache,
} from "../providers/cache_providers.ts";
import {
  type BenchmarkReportSchema,
  type DailyScenarioLogSchema,
  type StandardOutcomeSchema,
  type UnifiedLog,
  UnifiedLogSchema,
} from "../schemas/financial_domain_schemas.ts";
import {
  CanonicalLogEnvelopeSchema,
  type CanonicalLogKind,
  type EventType,
} from "../schemas/system_event_schemas.ts";

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
    orthogonalityThreshold: z.number().min(0).max(1).optional(),
  }),
  universe: z.object({
    symbols: z.array(z.string()),
  }),
  execution: z.object({
    costs: z.object({
      feeBps: z.number().min(0),
      slippageBps: z.number().min(0),
    }),
  }),
  logging: z
    .object({
      envelope: z
        .object({
          version: z.string().default("v2"),
        })
        .default({ version: "v2" }),
    })
    .optional(),
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
      throw new Error(
        `Invalid configuration: ${JSON.stringify(result.error.format())}`,
      );
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
      throw new Error(`Environment variable ${key} is required but not found.`);
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
      throw new Error("Project name is not configured.");
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

function createLogPath(bucket: string, fileName: string): string {
  const logsBase = core.config.paths.logs;
  const logsDir = join(logsBase, bucket);
  mkdirSync(logsDir, { recursive: true });
  return join(logsDir, fileName);
}

function toDateKeyFromIso(isoLike: string): string {
  return isoLike.split("T")[0]?.replaceAll("-", "") || "";
}

function extractAsOfDate(validated: UnifiedLog): string {
  if (validated.schema === "investor.daily-log.v1") {
    return (validated.report as z.infer<typeof DailyScenarioLogSchema>).date;
  }
  if (validated.schema === "investor.benchmark-log.v1") {
    return (validated.report as z.infer<typeof BenchmarkReportSchema>).date;
  }
  if (validated.schema === "investor.investment-outcome.v1") {
    const ts = (validated.report as z.infer<typeof StandardOutcomeSchema>)
      .timestamp;
    return toDateKeyFromIso(ts);
  }
  return "";
}

function resolveSourceBucket(schema: UnifiedLog["schema"]): string {
  switch (schema) {
    case "investor.daily-log.v1":
      return "unified";
    case "investor.benchmark-log.v1":
      return "unified";
    case "investor.investment-outcome.v1":
      return "unified";
    default:
      return "unknown";
  }
}

function resolveCanonicalKind(schema: UnifiedLog["schema"]): CanonicalLogKind {
  switch (schema) {
    case "investor.daily-log.v1":
      return "daily_decision";
    case "investor.benchmark-log.v1":
      return "benchmark";
    case "investor.investment-outcome.v1":
      return "investment_outcome";
    default:
      return "system_event";
  }
}

function buildCanonicalFileName(
  kind: CanonicalLogKind,
  asOfDate: string,
  generatedAt: string,
): string {
  const compactTs = generatedAt.replace(/[^\d]/g, "").slice(0, 14);
  return `${kind}_${asOfDate}_${compactTs}.json`;
}

export function writeCanonicalLog(data: UnifiedLog): void {
  const validated = UnifiedLogSchema.parse(data);
  let dateStr = extractAsOfDate(validated);
  if (!dateStr || !/^\d{8}$/.test(dateStr)) {
    dateStr = toDateKeyFromIso(new Date().toISOString());
  }

  writeCanonicalEnvelope({
    kind: resolveCanonicalKind(validated.schema),
    asOfDate: dateStr,
    generatedAt: validated.generatedAt || new Date().toISOString(),
    payload: validated,
    producerComponent: "app_runtime_core.writeCanonicalLog",
    sourceSchema: validated.schema,
    sourceBucket: resolveSourceBucket(validated.schema),
    derived: false,
  });
}

export function writeCanonicalEnvelope(input: {
  kind: CanonicalLogKind;
  payload: unknown;
  asOfDate?: string;
  generatedAt?: string;
  producerComponent?: string;
  sourceSchema?: string;
  sourceBucket?: string;
  sourceFile?: string;
  parentIds?: string[];
  derived?: boolean;
}): string {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const asOfDate =
    input.asOfDate && /^\d{8}$/.test(input.asOfDate)
      ? input.asOfDate
      : toDateKeyFromIso(generatedAt);

  const canonical = CanonicalLogEnvelopeSchema.parse({
    schema: "investor.log-envelope.v2",
    id: crypto.randomUUID(),
    runId: process.env.UQTL_RUN_ID,
    kind: input.kind,
    asOfDate,
    generatedAt,
    producer: {
      component: input.producerComponent || "app_runtime_core.writeCanonicalEnvelope",
    },
    payload: input.payload,
    derived: input.derived ?? false,
    lineage:
      input.sourceSchema || input.sourceBucket || input.sourceFile || input.parentIds
        ? {
            sourceSchema: input.sourceSchema,
            sourceBucket: input.sourceBucket,
            sourceFile: input.sourceFile,
            parentIds: input.parentIds,
          }
        : undefined,
  });

  const canonicalPath = createLogPath(
    "unified",
    buildCanonicalFileName(canonical.kind, asOfDate, generatedAt),
  );
  writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2), "utf8");
  console.log(`[Core] Canonical log written to ${canonicalPath}`);
  return canonicalPath;
}

export async function runParallel(task: () => Promise<void>): Promise<void> {
  const { Orchestrator } = await import("./runtime_engine.ts");
  const orchestrator = new Orchestrator();
  await orchestrator.runParallel(task);
}

export { core as Core };
export const eventStore = core.eventStore;
