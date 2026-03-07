import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";

export type PathRegistry = {
  // Core roots
  dataRoot: string;
  logsRoot: string;
  verificationRoot: string;
  cacheRoot: string;
  edinetRoot: string;
  preprocessedRoot: string;

  // J-Quants data files
  stockListCsv: string;
  stockPriceCsv: string;
  stockFinCsv: string;

  // Outputs and verification
  verificationJson: string;

  // Cache files
  marketCacheSqlite: string;
  marketdataSqlite: string;
  httpCacheSqlite: string;
  yahooCacheSqlite: string;
  jquantsPeadCacheSqlite: string;
  uqtlSqlite: string;
  memorySqlite: string;
  alphaKnowledgebaseSqlite: string;
  ofrHfmSqlite: string;

  // EDINET specific
  edinetCacheSqlite: string;
  edinetSearchSqlite: string;
  edinetDocsDir: string;

  // Logs
  unifiedLogDir: string;
  missionMd: string;
};

export function buildPathRegistry(): PathRegistry {
  const configPath = join(import.meta.dir, "..", "config", "default.yaml");
  const configDir = dirname(configPath);
  const raw = yaml.load(readFileSync(configPath, "utf8")) as {
    paths: {
      data: string;
      logs: string;
      verification: string;
      cache: string;
      edinet: string;
      preprocessed: string;
    };
  };

  // Build core root paths
  const dataRoot =
    process.env.UQTL_DATA_ROOT ||
    (isAbsolute(raw.paths.data)
      ? raw.paths.data
      : resolve(configDir, raw.paths.data));
  const logsRoot =
    process.env.UQTL_LOGS_ROOT ||
    (isAbsolute(raw.paths.logs)
      ? raw.paths.logs
      : resolve(configDir, raw.paths.logs));
  const verificationRoot =
    process.env.UQTL_VERIFICATION_ROOT ||
    (isAbsolute(raw.paths.verification)
      ? raw.paths.verification
      : resolve(configDir, raw.paths.verification));
  const cacheRoot =
    process.env.UQTL_CACHE_ROOT ||
    (isAbsolute(raw.paths.cache)
      ? raw.paths.cache
      : resolve(configDir, raw.paths.cache));
  const edinetRoot =
    process.env.UQTL_EDINET_ROOT ||
    (isAbsolute(raw.paths.edinet)
      ? raw.paths.edinet
      : resolve(configDir, raw.paths.edinet));
  const preprocessedRoot =
    process.env.UQTL_PREPROCESSED_ROOT ||
    (isAbsolute(raw.paths.preprocessed)
      ? raw.paths.preprocessed
      : resolve(configDir, raw.paths.preprocessed));

  return {
    dataRoot,
    logsRoot,
    verificationRoot,
    cacheRoot,
    edinetRoot,
    preprocessedRoot,
    stockListCsv: join(dataRoot, "stock_list.csv"),
    stockPriceCsv: join(dataRoot, "raw_stock_price.csv"),
    stockFinCsv: join(dataRoot, "raw_stock_fin.csv"),
    verificationJson: join(verificationRoot, "standard_verification_data.json"),
    marketCacheSqlite: join(cacheRoot, "market_cache.sqlite"),
    marketdataSqlite: join(cacheRoot, "marketdata.sqlite"),
    httpCacheSqlite: join(cacheRoot, "http_cache.sqlite"),
    yahooCacheSqlite: join(cacheRoot, "yahoo_finance_cache.sqlite"),
    jquantsPeadCacheSqlite: join(cacheRoot, "jquants_pead_cache.sqlite"),
    uqtlSqlite: join(cacheRoot, "uqtl.sqlite"),
    memorySqlite: join(cacheRoot, "memory.sqlite"),
    alphaKnowledgebaseSqlite: join(cacheRoot, "alpha_knowledgebase.sqlite"),
    ofrHfmSqlite: join(cacheRoot, "ofr_hfm.sqlite"),
    unifiedLogDir: join(logsRoot, "unified"),
    edinetCacheSqlite: join(edinetRoot, "cache.sqlite"),
    edinetSearchSqlite: join(edinetRoot, "search.sqlite"),
    edinetDocsDir: join(edinetRoot, "docs"),
    missionMd: join(logsRoot, "mission.md"),
  };
}

export const paths = buildPathRegistry();
