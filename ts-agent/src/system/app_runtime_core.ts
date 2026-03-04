import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
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
import { dateUtils } from "../utils/date_utils.ts";
import { fsUtils } from "../utils/fs_utils.ts";
import { logger } from "../utils/logger.ts";
import { withTelemetry } from "./telemetry_logger.ts";

const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
  }),
  runtime: z
    .object({
      envFile: z.string().optional(),
    })
    .optional(),
  paths: z.object({
    data: z.string(),
    logs: z.string(),
    verification: z.string(),
  }),
  providers: z.object({
    yfinance: z.object({ enabled: z.boolean() }),
    jquants: z.object({
      enabled: z.boolean(),
      apiKey: z.string().optional(),
      apiKeyEnv: z.string().optional(),
    }),
    edinet: z.object({
      enabled: z.boolean(),
      apiKey: z.string().optional(),
      apiKeyEnv: z.string().optional(),
    }),
    estat: z.object({
      enabled: z.boolean(),
      appId: z.string().optional(),
      appIdEnv: z.string().optional(),
    }),
    ai: z.object({
      enabled: z.boolean(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
    }),
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
  pipelineBlueprint: z
    .object({
      stateMonitor: z
        .object({
          regimeUpdateFrequencyMinutes: z.number().int().positive(),
          volatilityLookbackDays: z.number().int().positive(),
          regimeThreshold: z.number().min(0).max(1),
          volatilityThreshold: z.number().min(0).max(1),
        })
        .optional(),
      dataAcceptance: z
        .object({
          minQualityScore: z.number().min(0).max(1),
          minCoverageRate: z.number().min(0),
          maxMissingRate: z.number().min(0).max(1),
          maxLatencyMinutes: z.number().min(0),
          requireLeakFree: z.boolean(),
          minSourceConsistency: z.number().min(0).max(1),
        })
        .optional(),
      researchDesign: z
        .object({
          trainDays: z.number().int().positive(),
          validationDays: z.number().int().positive(),
          forwardDays: z.number().int().positive(),
        })
        .optional(),
      verificationAcceptance: z
        .object({
          minSharpe: z.number(),
          minIC: z.number(),
          maxDrawdown: z.number().min(0),
          minAnnualizedReturn: z.number(),
        })
        .optional(),
      executionConstraints: z
        .object({
          maxPositionWeight: z.number().min(0).max(1),
          maxTurnover: z.number().min(0),
          minLiquidityJpy: z.number().min(0),
        })
        .optional(),
      executionQuality: z
        .object({
          minFillRate: z.number().min(0).max(1),
          maxSlippageBps: z.number().min(0),
          maxExecutionLatencyMs: z.number().int().min(0),
        })
        .optional(),
      driftRetraining: z
        .object({
          maxTrackingError: z.number().min(0),
          maxRollingDrawdown: z.number().min(0),
          minWinRate: z.number().min(0).max(1),
        })
        .optional(),
      alphaLoop: z
        .object({
          maxCycles: z.number().int().min(1).default(3),
          sleepSec: z.number().int().min(0).default(0),
          maxFailures: z.number().int().min(1).default(1),
        })
        .optional(),
    })
    .optional(),
  alpha: z
    .object({
      edinet: z
        .object({
          gates: z
            .object({
              minSignalsPerDay: z.number().int().positive(),
              maxCorrection90d: z.number().int().min(0),
              minLiquidityJpy: z.number().min(0),
              regimeAllowlist: z.array(z.string()).min(1),
            })
            .optional(),
          weights: z
            .object({
              base: z
                .object({
                  riskDelta: z.number(),
                  pead1d: z.number(),
                  pead5d: z.number(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  database: z
    .object({
      canonicalDb: z
        .object({
          enabled: z.boolean().default(false),
          dualWriteEnabled: z.boolean().default(false),
          connectionString: z.string().optional(),
          host: z.string().optional(),
          port: z.number().int().positive().optional(),
          database: z.string().optional(),
          user: z.string().optional(),
          password: z.string().optional(),
          ssl: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
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
  // インポートサイクルを避けるため any/unknown で扱うか、インポートを関数内に閉じる
  public readonly cache: any;
  public readonly db: any;
  public readonly postgres: PostgresClient | null;
  public readonly eventStore: EventStore;

  public static loadDefaultConfigYaml(): unknown {
    const configPath = join(
      process.cwd(),
      "ts-agent",
      "src",
      "config",
      "default.yaml",
    );
    if (!existsSync(configPath)) {
      const altPath = join(process.cwd(), "src", "config", "default.yaml");
      if (existsSync(altPath)) return yaml.load(readFileSync(altPath, "utf8"));
      throw new Error(`Config file not found at ${configPath}`);
    }
    return yaml.load(readFileSync(configPath, "utf8"));
  }

  constructor() {
    // .env ファイルを自力でパースして注入するよっ！✨
    const envPath = join(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const [key, ...vals] = line.split("=");
        if (key && vals.length > 0) {
          const val = vals.join("=").trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }

    this.config = this.loadConfig();
    this.eventStore = eventStore;
    this.db = null;
    this.cache = null;

    const pgCfg = buildCanonicalDbConfig(this.config);
    this.postgres = pgCfg.enabled ? new PostgresClient(pgCfg) : null;
  }

  private loadConfig(): Config {
    const data = Core.loadDefaultConfigYaml();
    const result = ConfigSchema.safeParse(data);
    if (!result.success) {
      logger.error("Invalid configuration 😡");
      throw new Error("Invalid configuration");
    }
    return result.data as Config;
  }

  public getEnv(key: string, defaultValue = ""): string {
    return process.env[key] || defaultValue;
  }

  /**
   * 必須の環境変数を取得するよっ！無いと怒っちゃうんだからねっ💢✨
   */
  public getRequiredEnv(key: string): string {
    const val = this.getEnv(key);
    if (!val) {
      logger.error(`Missing required environment variable: ${key} 😡`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return val;
  }

  /**
   * プロバイダーごとの資格情報を、設定ファイルか環境変数から可愛く取得するよっ！🔑✨
   */
  public getProviderCredential(
    provider: keyof Config["providers"],
    key: string,
    envKey?: string,
  ): string {
    const p = this.config.providers[provider] as any;
    if (p?.[key]) return p[key];
    if (envKey) {
      const val = this.getEnv(envKey);
      if (val) return val;
    }
    return "";
  }

  /**
   * venv 内の Python 実行パスを可愛く解決するよっ！🐍✨
   */
  public getVenvPythonPath(): string {
    const pythonCfg = this.config.providers.python;
    if (pythonCfg?.uvPath) return pythonCfg.uvPath;
    const venvDir = pythonCfg?.venvDir || ".venv";
    // びよーんと OS に合わせてパスを変えちゃうよっ！🎀
    const isWindows = process.platform === "win32";
    return join(
      process.cwd(),
      venvDir,
      isWindows ? "Scripts" : "bin",
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

  /**
   * イベントを発行するよっ！✨
   * experimentId などのコンテキストを自動で拾うように強化したんだもん！🛡️
   */
  public emitEvent(
    type: EventType,
    payload: Record<string, object | string | number | boolean>,
    metadata: Record<string, object | string | number | boolean> = {},
  ) {
    const id = randomUUID();
    const timestamp = dateUtils.nowIso();

    // TODO: 共通のランタイム状態から拾えるようにするともっといいかも！🎀
    const event = {
      id,
      timestamp,
      type,
      agentId: this.constructor.name,
      experimentId:
        (metadata.experimentId as string) || process.env.UQTL_EXPERIMENT_ID,
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

  /**
   * 自然言語入力を環境変数やファイルから可愛く読み込むよっ！🗣️
   */
  protected readNaturalLanguageInput(): {
    text: string;
    source: "ENV" | "FILE" | "NONE";
  } {
    const fromEnv = (process.env.UQTL_NL_INPUT || "").trim();
    if (fromEnv.length > 0) return { text: fromEnv, source: "ENV" };
    const filePath = (process.env.UQTL_NL_INPUT_FILE || "").trim();
    if (filePath.length > 0 && existsSync(filePath)) {
      const content = fsUtils.readJsonFile<{ text?: string } | string>(
        filePath,
      );
      const text = typeof content === "string" ? content : content.text || "";
      if (text.length > 0) return { text, source: "FILE" };
    }
    return { text: "", source: "NONE" };
  }

  /**
   * 設定ファイルや環境変数から、可愛く設定を読み込むよっ！🎀
   */
  protected getConfig<T>(path: string, defaultValue: T): T {
    const keys = path.split(".");
    let current: any = this.core.config;
    for (const key of keys) {
      if (current === undefined || current === null) return defaultValue;
      current = current[key];
    }
    return current === undefined ? defaultValue : current;
  }

  /**
   * ミッションファイルを読み込んでコンテキストを解決するよっ！🎯
   */
  protected loadMissionContext(): string {
    // インポートサイクルを避けるために dynamic import を検討するよ
    const missionPath = join(this.core.config.paths.data, "mission.md");
    if (existsSync(missionPath)) {
      return readFileSync(missionPath, "utf8");
    }
    return "";
  }

  /**
   * 標準レポート（StandardOutcome）を可愛く永続化するよっ！📝✨
   */
  protected writeStandardOutcome(outcome: StandardOutcome): void {
    const validated = StandardOutcomeSchema.parse(outcome);
    writeCanonicalLog({
      schema: "investor.investment-outcome.v1",
      generatedAt: validated.timestamp || dateUtils.nowIso(),
      report: validated,
    });

    // ついでにイベントも発行しちゃうよっ！✨
    this.emitEvent("OUTCOME_GENERATED", {
      strategyId: validated.strategyId,
      score: validated.reasoningScore ?? 0,
      isProductionReady: validated.stability?.isProductionReady ?? false,
    });

    logger.info(
      `📝 [${this.constructor.name}] StandardOutcome persisted: ${validated.strategyId}`,
    );
  }

  /**
   * 処理をテレメトリ付きで実行するよっ！⏱️✨
   */
  protected async withTelemetry<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return withTelemetry(this.constructor.name, name, fn);
  }

  /**
   * 🛠️ スキルを検索して実行するよっ！✨
   */
  public async useSkill<T = any, R = any>(name: string, args: T): Promise<R> {
    const { skillRegistry } = await import("../skills/registry.ts");
    const skill = skillRegistry.getSkill(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name} 😡`);
    }

    logger.info(`[${this.constructor.name}] Using skill: ${name} 🚀`);
    // スキーマチェックもしちゃうよ！🛡️
    const validatedArgs = skill.schema.parse(args);
    return await skill.execute(validatedArgs);
  }

  /**
   * 📂 使えるスキルの一覧を表示するよっ！
   */
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
  const dateStr = dateUtils.todayYmd();
  writeCanonicalEnvelope({
    kind: CanonicalLogKind.ALPHA_DISCOVERY,
    asOfDate: dateStr,
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
