import { randomUUID } from "node:crypto";
import "../skills/index.ts";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type EventStore,
  eventStore,
  MemoryCenter,
} from "../context/unified_context_services.ts";
import { mirrorEventToCanonical } from "../db/adapters/canonical_bridge.ts";
import {
  buildCanonicalDbConfig,
  PostgresClient,
} from "../db/postgres_client.ts";
import {
  CanonicalLogKind,
  type EventType,
  type StandardOutcome,
  StandardOutcomeSchema,
  type UnifiedLog,
  UnifiedLogSchema,
} from "../schemas/financial_domain_schemas.ts";
import { skillRegistry } from "../skills/registry.ts";
import { dateUtils } from "../utils/date_utils.ts";
import { fsUtils } from "../utils/fs_utils.ts";
import { logger } from "../utils/logger.ts";
import { type Config, loadRuntimeConfig } from "./runtime_config.ts";
import { withTelemetry } from "./telemetry_logger.ts";

class Core {
  public readonly config: Config;
  public readonly cache: any;
  public readonly db: any;
  public readonly postgres: PostgresClient | null;
  public readonly eventStore: EventStore;

  constructor() {
    this.config = loadRuntimeConfig();
    this.eventStore = eventStore;
    this.db = null;
    this.cache = null;
    const pgCfg = buildCanonicalDbConfig(this.config);
    this.postgres = pgCfg.enabled ? new PostgresClient(pgCfg) : null;
  }

  public getEnv(key: string, defaultValue = ""): string {
    return process.env[key] || defaultValue;
  }

  public getRequiredEnv(key: string): string {
    const val = this.getEnv(key);
    if (!val) {
      logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return val;
  }

  public getProviderCredential(
    provider: keyof Config["providers"],
    key: string,
    envKey?: string,
  ): string {
    const providerConfig = this.config.providers[provider] as any;
    if (!providerConfig) return "";
    const dynamicEnvKey = providerConfig[`${key}Env` as const] || envKey;
    if (dynamicEnvKey) {
      const envValue = this.getEnv(dynamicEnvKey);
      if (envValue) return envValue;
    }
    if (providerConfig[key]) return providerConfig[key];
    return "";
  }

  public getVenvPythonPath(): string {
    const pythonCfg = this.config.providers.python;
    if (pythonCfg?.uvPath) return pythonCfg.uvPath;
    const venvDir = pythonCfg?.venvDir || ".venv";
    return join(
      process.cwd(),
      venvDir,
      process.platform === "win32" ? "Scripts" : "bin",
      "python",
    );
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
    payload: Record<string, object | string | number | boolean>,
    metadata: Record<string, object | string | number | boolean> = {},
  ) {
    const id = randomUUID();
    const timestamp = dateUtils.nowIso();
    const event = {
      id,
      timestamp,
      type,
      agentId: this.constructor.name,
      experimentId:
        (metadata.experimentId as string) ||
        this.core.getEnv("UQTL_EXPERIMENT_ID"),
      parentEventId: (metadata.parentEventId as string) || undefined,
      payload,
      metadata,
    };

    core.eventStore.appendEvent(event);
    const memory = new MemoryCenter();
    memory.pushEvent(event);
    memory.close();

    void mirrorEventToCanonical({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      agentId: event.agentId,
      experimentId: event.experimentId,
      parentEventId: event.parentEventId,
      payload: event.payload,
      metadata: event.metadata,
    }).catch((error) => {
      logger.warn(
        `[${this.constructor.name}] canonical event mirror failed: ${String(error)}`,
      );
    });
  }

  public abstract run(): Promise<void>;

  protected readNaturalLanguageInput(): {
    text: string;
    source: "ENV" | "FILE" | "NONE";
  } {
    const fromEnv = this.core.getEnv("UQTL_NL_INPUT").trim();
    if (fromEnv.length > 0) return { text: fromEnv, source: "ENV" };
    const filePath = this.core.getEnv("UQTL_NL_INPUT_FILE").trim();
    if (filePath.length > 0 && existsSync(filePath)) {
      const content = fsUtils.readJsonFile<{ text?: string } | string>(
        filePath,
      );
      const text = typeof content === "string" ? content : content.text || "";
      if (text.length > 0) return { text, source: "FILE" };
    }
    return { text: "", source: "NONE" };
  }

  protected getConfig<T>(path: string, defaultValue: T): T {
    const keys = path.split(".");
    let current: any = this.core.config;
    for (const key of keys) {
      if (current === undefined || current === null) return defaultValue;
      current = current[key];
    }
    return current === undefined ? defaultValue : current;
  }

  protected loadMissionContext(): string {
    const missionPath = join(this.core.config.paths.data, "mission.md");
    if (existsSync(missionPath)) {
      return readFileSync(missionPath, "utf8");
    }
    return "";
  }

  protected writeStandardOutcome(outcome: StandardOutcome): void {
    const validated = StandardOutcomeSchema.parse(outcome);
    writeCanonicalLog({
      schema: "investor.investment-outcome.v1",
      generatedAt: validated.timestamp || dateUtils.nowIso(),
      report: validated,
    });

    this.emitEvent("OUTCOME_GENERATED", {
      strategyId: validated.strategyId,
      score: (validated as any).reasoningScore ?? 0,
      isProductionReady: validated.stability?.isProductionReady ?? false,
    });

    logger.info(
      `[${this.constructor.name}] StandardOutcome persisted: ${validated.strategyId}`,
    );
  }

  protected async withTelemetry<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return withTelemetry(this.constructor.name, name, fn);
  }

  public async useSkill<TInput, TOutput>(
    name: string,
    args: TInput,
  ): Promise<TOutput> {
    const skill = skillRegistry.getSkill(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }
    logger.info(
      `[${this.constructor.name}] Using skill: ${name} — ${skill.description}`,
    );
    const validatedArgs = skill.schema.parse(args);
    return (await skill.execute(validatedArgs)) as TOutput;
  }

  public async listAvailableSkills(): Promise<string[]> {
    const { skillRegistry } = await import("../skills/registry.ts");
    return skillRegistry.listSkills().map((s) => `${s.name}: ${s.description}`);
  }
}

export const core = new Core();

function createLogPath(bucket: string, fileName: string): string {
  const logsBase = core.config.paths.logs;
  const logsDir = join(logsBase, bucket);
  mkdirSync(logsDir, { recursive: true });
  return join(logsDir, fileName);
}

export function writeCanonicalLog(data: UnifiedLog): void {
  const validated = UnifiedLogSchema.parse(data);
  writeCanonicalEnvelope({
    kind: CanonicalLogKind.ALPHA_DISCOVERY,
    asOfDate: dateUtils.todayYmd(),
    generatedAt: validated.generatedAt || dateUtils.nowIso(),
    payload: validated,
  });
}

export function writeCanonicalEnvelope(input: {
  kind: CanonicalLogKind;
  payload: object;
  asOfDate?: string;
  generatedAt?: string;
  producerComponent?: string;
  producerVersion?: string;
}): string {
  const generatedAt = input.generatedAt || dateUtils.nowIso();
  const asOfDate = input.asOfDate || dateUtils.todayYmd();
  const canonical = {
    schema: "investor.log-envelope.v2",
    id: randomUUID(),
    kind: input.kind,
    asOfDate,
    generatedAt,
    producerComponent: input.producerComponent || "unknown",
    producerVersion: input.producerVersion || "v1.0.0",
    payload: input.payload,
  };
  const canonicalPath = createLogPath("unified", `log_${Date.now()}.json`);
  fsUtils.writeValidatedJson(canonicalPath, canonical);
  return canonicalPath;
}
