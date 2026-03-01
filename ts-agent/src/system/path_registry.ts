import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import yaml from "js-yaml";

export type PathRegistry = {
  dataRoot: string;
  logsRoot: string;
  verificationRoot: string;
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
  unifiedLogDir: string;
  edinetCacheSqlite: string;
  edinetDocsDir: string;
  missionMd: string;
};

export function buildPathRegistry(): PathRegistry {
  const configPath = join(import.meta.dir, "..", "config", "default.yaml");
  const configDir = dirname(configPath);
  const raw = yaml.load(readFileSync(configPath, "utf8")) as {
    paths: { data: string; logs: string; verification: string };
  };
  const dataRoot = isAbsolute(raw.paths.data)
    ? raw.paths.data
    : resolve(configDir, raw.paths.data);
  const logsRoot = isAbsolute(raw.paths.logs)
    ? raw.paths.logs
    : resolve(configDir, raw.paths.logs);
  const verificationRoot = isAbsolute(raw.paths.verification)
    ? raw.paths.verification
    : resolve(configDir, raw.paths.verification);
  const cacheDir = join(logsRoot, "cache");
  return {
    dataRoot,
    logsRoot,
    verificationRoot,
    stockListCsv: join(dataRoot, "stock_list.csv"),
    stockPriceCsv: join(dataRoot, "raw_stock_price.csv"),
    stockFinCsv: join(dataRoot, "raw_stock_fin.csv"),
    verificationJson: join(verificationRoot, "standard_verification_data.json"),
    marketCacheSqlite: join(cacheDir, "market_cache.sqlite"),
    marketdataSqlite: join(cacheDir, "marketdata.sqlite"),
    httpCacheSqlite: join(cacheDir, "http_cache.sqlite"),
    yahooCacheSqlite: join(cacheDir, "yahoo_finance_cache.sqlite"),
    jquantsPeadCacheSqlite: join(cacheDir, "jquants_pead_cache.sqlite"),
    uqtlSqlite: join(cacheDir, "uqtl.sqlite"),
    unifiedLogDir: join(logsRoot, "unified"),
    edinetCacheSqlite: join(cacheDir, "edinet_cache.sqlite"),
    edinetDocsDir: join(cacheDir, "edinet_docs"),
    missionMd: join(import.meta.dir, "..", "..", "alpha_discovery_mission.md"),
  };
}

export const paths = buildPathRegistry();
