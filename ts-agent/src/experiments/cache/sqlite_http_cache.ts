import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const CacheRowSchema = z.object({
  value: z.string(),
  expires_at: z.number().int(),
});

const stableKey = (url: string, headers: Record<string, string>): string =>
  JSON.stringify({
    url,
    headers: Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  });

type ErrorLikePayload = { message?: unknown } & Record<string, unknown>;
const isErrorLikePayload = (payload: ErrorLikePayload): boolean =>
  z.string().safeParse(payload.message).success;
const isEmptyPayload = (payload: Record<string, unknown>): boolean =>
  Object.keys(payload).length === 0;

export class SqliteHttpCache {
  private readonly db: Database;

  constructor(dbPath: string) {
    const path = resolve(dbPath);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS http_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_http_cache_expires_at ON http_cache(expires_at);
    `);
  }

  public fetchJson = async (
    url: string,
    headers: Record<string, string>,
    ttlMs: number,
  ): Promise<Record<string, unknown>> => {
    const now = Date.now();
    const key = stableKey(url, headers);
    const cached = this.db
      .query("SELECT value, expires_at FROM http_cache WHERE key = ?1")
      .get(key) as { value: string; expires_at: number } | null;
    const valid = CacheRowSchema.safeParse(cached);
    const cachedHitRaw =
      valid.success && valid.data.expires_at > now
        ? z
            .record(z.string(), z.unknown())
            .catch({})
            .parse(JSON.parse(valid.data.value))
        : undefined;
    const cachedHit =
      cachedHitRaw &&
      !isErrorLikePayload(cachedHitRaw) &&
      !isEmptyPayload(cachedHitRaw)
        ? cachedHitRaw
        : undefined;
    const payload = await (cachedHit ??
      (async () => {
        const response = await fetch(url, { headers });
        return response.ok
          ? z
              .record(z.string(), z.unknown())
              .catch({})
              .parse(await response.json())
          : {};
      })());
    const shouldWrite =
      cachedHit === undefined &&
      !isErrorLikePayload(payload) &&
      !isEmptyPayload(payload);
    shouldWrite &&
      this.db
        .query(
          `INSERT INTO http_cache (key, value, created_at, expires_at)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             created_at = excluded.created_at,
             expires_at = excluded.expires_at`,
        )
        .run(key, JSON.stringify(payload), now, now + ttlMs);
    return payload;
  };
}
