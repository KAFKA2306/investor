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
import { ApiVerifyGateway } from "../providers/unified_market_data_gateway.ts";
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
  QualityGateSchema,
} from "../schemas/system_event_schemas.ts";

const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
  }),
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
        verification: isAbsolute(result.data.paths.verification)
          ? result.data.paths.verification
          : resolve(configDir, result.data.paths.verification),
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
    payload: Record<string, object | string | number | boolean>,
    metadata: Record<string, object | string | number | boolean> = {},
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

    const memory = new MemoryCenter();
    memory.pushEvent(event);
    memory.close();
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
  if (schema === "investor.daily-log.v1") return "unified";
  if (schema === "investor.benchmark-log.v1") return "unified";
  if (schema === "investor.investment-outcome.v1") return "unified";
  return "other";
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
  payload: object;
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
      component:
        input.producerComponent || "app_runtime_core.writeCanonicalEnvelope",
    },
    payload: input.payload,
    derived: input.derived ?? false,
    ...(input.sourceSchema ||
    input.sourceBucket ||
    input.sourceFile ||
    input.parentIds
      ? {
          lineage: {
            sourceSchema: input.sourceSchema,
            sourceBucket: input.sourceBucket,
            sourceFile: input.sourceFile,
            parentIds: input.parentIds,
          },
        }
      : {}),
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
  const orchestrator = new Orchestrator();
  await orchestrator.runParallel(task);
}

export interface EvaluationResult {
  score: number;
  feedback: string[];
  metadata: Record<string, object | string | number | boolean>;
}

export interface IEvaluator<TInput = object> {
  evaluate(output: TInput): Promise<EvaluationResult>;
}

export interface IProcessor {
  process(content: string): Promise<string>;
}

export interface IConstructor {
  construct(input: object, context: string[]): Promise<string>;
}

export interface IAcquirer {
  acquire(): Promise<string[]>;
}

export interface IEvolver {
  evolve(signal: EvaluationResult): Promise<void>;
}

export const OperatorMetadataSchema = z.object({
  id: z.string(),
  version: z.number(),
  description: z.string(),
});

export type OperatorMetadata = z.infer<typeof OperatorMetadataSchema>;

export interface OperatorContext {
  operatorId: string;
  parentEventId: string;
}

export abstract class UIFOperator<TState extends object, TEvent, TEffect> {
  public abstract readonly metadata: OperatorMetadata;

  public abstract process(
    state: TState,
    event: TEvent,
    context: OperatorContext,
  ): {
    effect: TEffect;
    newState: TState;
  };

  async emitEvent(
    type: EventType,
    payload: Record<string, object | string | number | boolean>,
    context: OperatorContext,
    metadata: Record<string, object | string | number | boolean> = {},
  ) {
    core.eventStore.appendEvent({
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      operatorId: context.operatorId,
      parentEventId: context.parentEventId,
      payload,
      metadata,
    });
  }
}

export class UIFRuntime {
  private states = new Map<string, object>();

  public async execute<TState extends object, TEvent, TEffect>(
    operator: UIFOperator<TState, TEvent, TEffect>,
    event: TEvent,
    parentEventId: string = "",
  ): Promise<TEffect> {
    const operatorId = operator.metadata.id;
    if (!this.states.has(operatorId)) {
      this.states.set(operatorId, this.getInitialState());
    }
    const state = this.states.get(operatorId) as TState;

    const context: OperatorContext = {
      operatorId: operator.metadata.id,
      parentEventId,
    };

    const { effect, newState } = operator.process(state, event, context);

    this.states.set(operator.metadata.id, newState);
    return effect;
  }

  private getInitialState(): object {
    return {};
  }
}

export const uifRuntime = new UIFRuntime();

export class Orchestrator {
  private readonly agentCount: number;

  constructor(agentCount = 4) {
    this.agentCount = Number(process.env.UIF_AGENT_COUNT) || agentCount;
  }

  public async runParallel(task: () => Promise<void>) {
    const runId = globalThis.crypto.randomUUID();
    console.log(
      `[Orchestrator] Launching ${this.agentCount} parallel agents... ✨`,
    );
    await this.emitSystemEvent("RUN_STARTED", {
      runId,
      agentCount: this.agentCount,
    });
    const agents = Array.from({ length: this.agentCount }, (_, i) =>
      this.spawnAgent(i, task, runId),
    );
    const result = await Promise.allSettled(agents);
    const rejected = result.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    if (!rejected) {
      await this.emitSystemEvent("RUN_FINISHED", {
        runId,
        agentCount: this.agentCount,
      });
      console.log("[Orchestrator] All parallel missions accomplished! ✨");
      return;
    }
    await this.emitSystemEvent("RUN_FAILED", {
      runId,
      agentCount: this.agentCount,
    });
    throw rejected.reason;
  }

  private async spawnAgent(
    id: number,
    task: () => Promise<void>,
    runId: string,
  ) {
    console.log(`[Orchestrator] Agent ${id} is starting mission... ✨`);
    await this.emitSystemEvent("AGENT_STARTED", { runId, agentId: id });
    const result = await task().then(
      () => ({ ok: true as const, error: null }),
      (error) => ({ ok: false as const, error }),
    );
    if (result.ok) {
      await this.emitSystemEvent("AGENT_COMPLETED", { runId, agentId: id });
      console.log(`[Orchestrator] Agent ${id} completed mission! ✨`);
      return;
    }
    await this.emitSystemEvent("AGENT_FAILED", {
      runId,
      agentId: id,
      reason:
        result.error instanceof Error
          ? result.error.message
          : String(result.error),
    });
    console.error(`[Orchestrator] Agent ${id} failed:`, result.error);
    throw result.error;
  }

  private async emitSystemEvent(
    type: Extract<
      EventType,
      | "RUN_STARTED"
      | "RUN_FINISHED"
      | "RUN_FAILED"
      | "AGENT_STARTED"
      | "AGENT_COMPLETED"
      | "AGENT_FAILED"
    >,
    payload: Record<string, object | string | number | boolean>,
  ) {
    core.eventStore.appendEvent({
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      operatorId: "Orchestrator",
      payload,
    });
  }
}

const VerifyTargetSchema = z.enum(["jquants", "kabucom", "edinet", "estat"]);

const VerifyTargetsSchema = z
  .string()
  .optional()
  .transform((v) => v ?? "jquants,kabucom,edinet,estat")
  .transform((v) =>
    v
      .split(",")
      .map((i) => i.trim().toLowerCase())
      .filter((i) => i.length > 0),
  )
  .pipe(z.array(VerifyTargetSchema).nonempty());

export const ApiVerificationReportSchema = z.object({
  verifiedAt: z.string(),
  jquants: z.object({
    listedCount: z.number().int().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  kabucom: z.object({
    resultCode: z.number().int().optional(),
    orderId: z.string().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  edinet: z.object({
    documentsCount: z.number().int().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
  estat: z.object({
    hasStatsData: z.boolean().optional(),
    status: z.enum(["PASS", "SKIP", "FAIL"]),
    reason: z.string().optional(),
  }),
});

export async function runApiVerification(): Promise<
  z.infer<typeof ApiVerificationReportSchema>
> {
  const env = z
    .object({ VERIFY_TARGETS: z.string().optional() })
    .parse(process.env);
  const targets = new Set(VerifyTargetsSchema.parse(env.VERIFY_TARGETS));
  const gateway = new ApiVerifyGateway();

  const verifyJquants = targets.has("jquants")
    ? gateway
        .getJquantsListedInfo()
        .then((l) => ({ listedCount: l.length, status: "PASS" as const }))
        .catch((error: Error) => ({
          status: "FAIL" as const,
          reason: error.message,
        }))
    : Promise.resolve({ status: "SKIP" as const });

  const verifyEstat = targets.has("estat")
    ? gateway
        .getEstatStatsData("0000010101")
        .then((r) => ({
          hasStatsData: Object.hasOwn(r, "GET_STATS_DATA"),
          status: "PASS" as const,
        }))
        .catch((error: Error) => ({
          status: "FAIL" as const,
          reason: error.message,
        }))
    : Promise.resolve({ status: "SKIP" as const });

  const verifyEdinet = targets.has("edinet")
    ? (async () => {
        const { EdinetProvider } = await import(
          "../providers/edinet_provider.ts"
        );
        const edinet = new EdinetProvider();
        return edinet.verify();
      })()
    : Promise.resolve({ status: "SKIP" as const, documentsCount: 0 });

  const [jquants, kabucom, edinet, estat] = await Promise.all([
    verifyJquants,
    { status: "SKIP" as const },
    verifyEdinet,
    verifyEstat,
  ]);

  return ApiVerificationReportSchema.parse({
    verifiedAt: new Date().toISOString(),
    jquants,
    kabucom,
    edinet,
    estat,
  });
}

export function deriveQualityGateFromVerification(
  report: z.infer<typeof ApiVerificationReportSchema>,
) {
  const targets = [report.jquants, report.estat];
  const passRatio =
    targets.filter((item) => item.status === "PASS").length / targets.length;

  const components = {
    dataConnectivity: Math.round(passRatio * 100),
    dataAvailability:
      report.jquants.status === "PASS" && report.estat.status === "PASS"
        ? 100
        : report.jquants.status === "FAIL" || report.estat.status === "FAIL"
          ? 0
          : 50,
    executionObservability: 60,
    reproducibility: 70,
  };
  const weightedScore = Math.round(
    components.dataConnectivity * 0.35 +
      components.dataAvailability * 0.35 +
      components.executionObservability * 0.15 +
      components.reproducibility * 0.15,
  );
  const verdict =
    weightedScore >= 75
      ? "READY"
      : weightedScore >= 50
        ? "CAUTION"
        : "NOT_READY";

  return QualityGateSchema.parse({
    verdict,
    score: weightedScore,
    components,
    derivedFrom: ["api_verification:jquants", "api_verification:estat"],
    generatedAt: new Date().toISOString(),
  });
}

export async function runAndPersistQualityGate() {
  const verification = await runApiVerification();
  const qualityGate = deriveQualityGateFromVerification(verification);
  const asOfDate = qualityGate.generatedAt.slice(0, 10).replaceAll("-", "");

  writeCanonicalEnvelope({
    kind: "quality_gate",
    asOfDate,
    generatedAt: qualityGate.generatedAt,
    producerComponent: "system.app_runtime_core.runAndPersistQualityGate",
    sourceSchema: "investor.api-verification.v1",
    sourceBucket: "unified",
    derived: true,
    payload: {
      ...qualityGate,
      connectivity: {
        jquants: {
          status: verification.jquants.status,
          listedCount: verification.jquants.listedCount,
        },
        estat: {
          status: verification.estat.status,
          hasStatsData: verification.estat.hasStatsData,
        },
        kabucom: {
          status: verification.kabucom.status,
        },
        edinet: {
          status: verification.edinet.status,
        },
      },
    },
  });

  return { verification, qualityGate };
}

export { core as Core };
export const eventStore = core.eventStore;
