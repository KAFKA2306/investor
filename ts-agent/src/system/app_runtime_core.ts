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
  type StandardOutcome,
  StandardOutcomeSchema,
  type UnifiedLog,
  UnifiedLogSchema,
} from "../schemas/financial_domain_schemas.ts";
import type {
  CanonicalLogKind,
  EventType,
} from "../schemas/system_event_schemas.ts";
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
    const configPath = join(import.meta.dir, "..", "config", "default.yaml");
    return yaml.load(readFileSync(configPath, "utf8"));
  }

  constructor() {
    this.config = this.loadConfig();
    // 歴史を刻むための EventStore くんを準備するよっ！📜✨
    this.eventStore = eventStore;
    // db や cache は後で可愛く繋いであげるから待っててねっ！🎀
    this.db = null;
    this.cache = null;

    // Postgres くんの準備もしておくねっ！🐘💎
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

  public getEnv(key: string): string {
    return process.env[key] || "";
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
    const id = crypto.randomUUID();
    const timestamp = dateUtils.nowIso();
    const event = {
      id,
      timestamp,
      type,
      agentId: this.constructor.name,
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
   * ミッションファイルを読み込んでコンテキストを解決するよっ！🎯
   */
  protected loadMissionContext(): string {
    const { paths: currentPaths } = require("./path_registry.ts");
    if (currentPaths.missionMd && existsSync(currentPaths.missionMd)) {
      return readFileSync(currentPaths.missionMd, "utf8");
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
    kind: "daily_decision",
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
}): string {
  const generatedAt = input.generatedAt || dateUtils.nowIso();
  const asOfDate = input.asOfDate || dateUtils.todayYmd();
  const canonical = {
    schema: "investor.log-envelope.v2",
    id: crypto.randomUUID(),
    kind: input.kind,
    asOfDate,
    generatedAt,
    payload: input.payload,
  };
  const canonicalPath = createLogPath("unified", `log_${Date.now()}.json`);
  fsUtils.writeValidatedJson(canonicalPath, canonical);
  return canonicalPath;
}
