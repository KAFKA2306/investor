import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPathRegistry,
  loadEnvironmentFile,
  loadRuntimeConfig,
} from "../../src/system/runtime_config.ts";

const baseConfig = `
project:
  name: investor-test
runtime:
  envFile: .env.test
paths:
  data: ./data
  logs: ./logs
  verification: ./verification
  cache: ./cache
  edinet: ./edinet
  preprocessed: ./preprocessed
providers:
  yfinance:
    enabled: true
  jquants:
    enabled: false
  edinet:
    enabled: false
  estat:
    enabled: false
  ai:
    enabled: false
    model: config-model
benchmark:
  foundation:
    noiseThresholdMultiplier: 1.5
    overconfidenceThreshold: 0.8
universe:
  symbols: ["1301", "1332"]
execution:
  costs:
    feeBps: 5
    slippageBps: 10
`;

describe("runtime_config", () => {
  it("loads env file without overwriting existing values", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-config-env-"));
    const envPath = join(root, ".env");
    const env = {
      OPENAI_API_KEY: "existing",
    } as Record<string, string | undefined>;

    writeFileSync(
      envPath,
      "OPENAI_API_KEY=from-file\nUQTL_API_TOKEN=file-token\n",
      "utf8",
    );

    loadEnvironmentFile(envPath, env);

    expect(env.OPENAI_API_KEY).toBe("existing");
    expect(env.UQTL_API_TOKEN).toBe("file-token");

    rmSync(root, { recursive: true, force: true });
  });

  it("loads config and applies env file defaults", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-config-load-"));
    const configPath = join(root, "default.yaml");
    const envPath = join(root, ".env.test");
    const env = {} as Record<string, string | undefined>;

    writeFileSync(configPath, baseConfig, "utf8");
    writeFileSync(envPath, "OPENAI_API_KEY=env-file-key\n", "utf8");

    const config = loadRuntimeConfig({ configPath, env });

    expect(config.project.name).toBe("investor-test");
    expect(config.providers.ai.model).toBe("config-model");
    expect(env.OPENAI_API_KEY).toBe("env-file-key");

    rmSync(root, { recursive: true, force: true });
  });

  it("builds paths from config and allows env overrides", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-config-paths-"));
    const configPath = join(root, "default.yaml");
    const envPath = join(root, ".env.test");
    const env = {
      UQTL_DATA_ROOT: join(root, "override-data"),
      UQTL_VERIFICATION_ROOT: join(root, "override-verification"),
    } as Record<string, string | undefined>;

    writeFileSync(configPath, baseConfig, "utf8");
    writeFileSync(envPath, "", "utf8");

    const config = loadRuntimeConfig({ configPath, env });
    const paths = buildPathRegistry(config, { configPath, env });

    expect(paths.dataRoot).toBe(join(root, "override-data"));
    expect(paths.verificationRoot).toBe(join(root, "override-verification"));
    expect(paths.logsRoot).toBe(join(root, "logs"));
    expect(paths.marketCacheSqlite).toBe(join(root, "cache", "market_cache.sqlite"));
    expect(paths.verificationJson).toBe(
      join(root, "override-verification", "standard_verification_data.json"),
    );

    rmSync(root, { recursive: true, force: true });
  });
});
