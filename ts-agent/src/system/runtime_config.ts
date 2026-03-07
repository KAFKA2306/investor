import { readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";

const RuntimeConfigSchema = z
  .object({
    project: z.object({
      name: z.string(),
    }),
    runtime: z
      .object({
        envFile: z.string().optional(),
      })
      .optional(),
    paths: z
      .object({
        data: z.string(),
        logs: z.string(),
        verification: z.string(),
        cache: z.string(),
        edinet: z.string(),
        preprocessed: z.string(),
        outputsRoot: z.string().optional(),
        outputsVerificationJson: z.string().optional(),
        logsUnifiedDir: z.string().optional(),
        edinetDocsDir: z.string().optional(),
        edinetSearchSqlite: z.string().optional(),
        marketdataListCsv: z.string().optional(),
        marketdataPricesCsv: z.string().optional(),
        marketdataFinCsv: z.string().optional(),
      })
      .passthrough(),
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
        apiKeyEnv: z.string().optional(),
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
            maxPValue: z.number(),
            maxDrawdown: z.number().min(0),
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
  })
  .passthrough();

export type Config = z.infer<typeof RuntimeConfigSchema>;
export type EnvironmentMap = Record<string, string | undefined>;

export type PathRegistry = {
  data: string;
  logs: string;
  verification: string;
  cache: string;
  edinet: string;
  preprocessed: string;
  dataRoot: string;
  logsRoot: string;
  verificationRoot: string;
  cacheRoot: string;
  edinetRoot: string;
  preprocessedRoot: string;
  outputsRoot: string;
  stockListCsv: string;
  stockPriceCsv: string;
  stockFinCsv: string;
  verificationJson: string;
  marketCacheSqlite: string;
  marketdataSqlite: string;
  httpCacheSqlite: string;
  yahooCacheSqlite: string;
  jquantsPeadCacheSqlite: string;
  uqtlSqlite: string;
  memorySqlite: string;
  alphaKnowledgebaseSqlite: string;
  ofrHfmSqlite: string;
  edinetCacheSqlite: string;
  edinetSearchSqlite: string;
  edinetDocsDir: string;
  unifiedLogDir: string;
  missionMd: string;
};

const parseEnvFile = (content: string): EnvironmentMap => {
  const entries: EnvironmentMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) continue;
    entries[key.trim()] = rest.join("=").trim();
  }
  return entries;
};

const resolveConfigPath = (configPath?: string): string =>
  configPath
    ? resolve(configPath)
    : join(import.meta.dir, "..", "config", "default.yaml");

const resolveConfiguredPath = (configDir: string, value: string): string =>
  isAbsolute(value) ? value : resolve(configDir, value);

export function loadEnvironmentFile(
  envFilePath: string,
  target: EnvironmentMap = process.env,
): void {
  const envContent = readFileSync(envFilePath, "utf8");
  const parsed = parseEnvFile(envContent);
  for (const [key, value] of Object.entries(parsed)) {
    if (!target[key]) {
      target[key] = value;
    }
  }
}

export function loadRuntimeConfig(options?: {
  configPath?: string;
  env?: EnvironmentMap;
}): Config {
  const env = options?.env ?? process.env;
  const configPath = resolveConfigPath(options?.configPath);
  const configDir = dirname(configPath);
  const raw = yaml.load(readFileSync(configPath, "utf8")) as Config;
  const envFile = raw.runtime?.envFile;
  if (envFile) {
    const envPath = resolveConfiguredPath(configDir, envFile);
    loadEnvironmentFile(envPath, env);
  }
  return RuntimeConfigSchema.parse(raw);
}

export function buildPathRegistry(
  config: Config,
  options?: {
    configPath?: string;
    env?: EnvironmentMap;
  },
): PathRegistry {
  const env = options?.env ?? process.env;
  const configDir = dirname(resolveConfigPath(options?.configPath));
  const dataRoot =
    env.UQTL_DATA_ROOT || resolveConfiguredPath(configDir, config.paths.data);
  const logsRoot =
    env.UQTL_LOGS_ROOT || resolveConfiguredPath(configDir, config.paths.logs);
  const verificationRoot =
    env.UQTL_VERIFICATION_ROOT ||
    resolveConfiguredPath(configDir, config.paths.verification);
  const cacheRoot =
    env.UQTL_CACHE_ROOT || resolveConfiguredPath(configDir, config.paths.cache);
  const edinetRoot =
    env.UQTL_EDINET_ROOT ||
    resolveConfiguredPath(configDir, config.paths.edinet);
  const preprocessedRoot =
    env.UQTL_PREPROCESSED_ROOT ||
    resolveConfiguredPath(configDir, config.paths.preprocessed);
  const outputsRoot = env.UQTL_VERIFICATION_ROOT
    ? verificationRoot
    : resolveConfiguredPath(
        configDir,
        config.paths.outputsRoot ?? config.paths.verification,
      );
  const marketdataListCsv = env.UQTL_DATA_ROOT
    ? join(
        dataRoot,
        basename(config.paths.marketdataListCsv ?? "stock_list.csv"),
      )
    : config.paths.marketdataListCsv
      ? resolveConfiguredPath(configDir, config.paths.marketdataListCsv)
      : join(dataRoot, "stock_list.csv");
  const marketdataPricesCsv = env.UQTL_DATA_ROOT
    ? join(
        dataRoot,
        basename(config.paths.marketdataPricesCsv ?? "raw_stock_price.csv"),
      )
    : config.paths.marketdataPricesCsv
      ? resolveConfiguredPath(configDir, config.paths.marketdataPricesCsv)
      : join(dataRoot, "raw_stock_price.csv");
  const marketdataFinCsv = env.UQTL_DATA_ROOT
    ? join(
        dataRoot,
        basename(config.paths.marketdataFinCsv ?? "raw_stock_fin.csv"),
      )
    : config.paths.marketdataFinCsv
      ? resolveConfiguredPath(configDir, config.paths.marketdataFinCsv)
      : join(dataRoot, "raw_stock_fin.csv");
  const verificationJson = env.UQTL_VERIFICATION_ROOT
    ? join(
        verificationRoot,
        basename(
          config.paths.outputsVerificationJson ??
            "standard_verification_data.json",
        ),
      )
    : config.paths.outputsVerificationJson
      ? resolveConfiguredPath(configDir, config.paths.outputsVerificationJson)
      : join(verificationRoot, "standard_verification_data.json");
  const unifiedLogDir = env.UQTL_LOGS_ROOT
    ? join(logsRoot, basename(config.paths.logsUnifiedDir ?? "unified"))
    : config.paths.logsUnifiedDir
      ? resolveConfiguredPath(configDir, config.paths.logsUnifiedDir)
      : join(logsRoot, "unified");

  return {
    data: dataRoot,
    logs: logsRoot,
    verification: verificationRoot,
    cache: cacheRoot,
    edinet: edinetRoot,
    preprocessed: preprocessedRoot,
    dataRoot,
    logsRoot,
    verificationRoot,
    cacheRoot,
    edinetRoot,
    preprocessedRoot,
    outputsRoot,
    stockListCsv: marketdataListCsv,
    stockPriceCsv: marketdataPricesCsv,
    stockFinCsv: marketdataFinCsv,
    verificationJson,
    marketCacheSqlite: join(cacheRoot, "market_cache.sqlite"),
    marketdataSqlite: join(cacheRoot, "marketdata.sqlite"),
    httpCacheSqlite: join(cacheRoot, "http_cache.sqlite"),
    yahooCacheSqlite: join(cacheRoot, "yahoo_finance_cache.sqlite"),
    jquantsPeadCacheSqlite: join(cacheRoot, "jquants_pead_cache.sqlite"),
    uqtlSqlite: join(cacheRoot, "uqtl.sqlite"),
    memorySqlite: join(cacheRoot, "memory.sqlite"),
    alphaKnowledgebaseSqlite: join(cacheRoot, "alpha_knowledgebase.sqlite"),
    ofrHfmSqlite: join(cacheRoot, "ofr_hfm.sqlite"),
    edinetCacheSqlite: join(cacheRoot, "edinet_cache.sqlite"),
    edinetSearchSqlite: resolveConfiguredPath(
      configDir,
      config.paths.edinetSearchSqlite ?? `${config.paths.edinet}/search.sqlite`,
    ),
    edinetDocsDir: resolveConfiguredPath(
      configDir,
      config.paths.edinetDocsDir ?? `${config.paths.edinet}/docs`,
    ),
    unifiedLogDir,
    missionMd: join(logsRoot, "mission.md"),
  };
}
