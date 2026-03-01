import { ensureCompatViews } from "../compat/views.ts";
import { core } from "../system/app_runtime_core.ts";
import { buildCanonicalDbConfig, PostgresClient } from "./postgres_client.ts";

let singleton: PostgresClient | null = null;

export async function bootstrapCanonicalDb(): Promise<PostgresClient | null> {
  if (singleton) return singleton;

  const cfg = buildCanonicalDbConfig(core.config);
  if (!cfg.enabled) {
    return null;
  }

  const client = new PostgresClient(cfg);
  await client.ensureSchema();
  await ensureCompatViews(client);
  singleton = client;
  return singleton;
}
