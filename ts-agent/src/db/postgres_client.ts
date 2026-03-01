import { Pool, type PoolClient, type QueryResult } from "pg";
import type { Config } from "../system/app_runtime_core.ts";
import { canonicalSchemaStatements } from "./schema.ts";

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<QueryResult>;
};

export type CanonicalDbConfig = {
  enabled: boolean;
  dualWriteEnabled: boolean;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
};

export function buildCanonicalDbConfig(config: Config): CanonicalDbConfig {
  const raw = config.database?.canonicalDb;
  return {
    enabled: raw?.enabled ?? false,
    dualWriteEnabled: raw?.dualWriteEnabled ?? false,
    connectionString:
      process.env.CANONICAL_DB_URL || raw?.connectionString || undefined,
    host: process.env.CANONICAL_DB_HOST || raw?.host || undefined,
    port: Number(process.env.CANONICAL_DB_PORT || raw?.port || 5432),
    database: process.env.CANONICAL_DB_NAME || raw?.database || undefined,
    user: process.env.CANONICAL_DB_USER || raw?.user || undefined,
    password: process.env.CANONICAL_DB_PASSWORD || raw?.password || undefined,
    ssl: raw?.ssl ?? false,
  };
}

export class PostgresClient {
  private readonly pool: Pool;
  private readonly cfg: CanonicalDbConfig;

  constructor(cfg: CanonicalDbConfig) {
    this.cfg = cfg;
    this.pool = new Pool({
      connectionString: cfg.connectionString,
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }

  public get enabled(): boolean {
    return this.cfg.enabled;
  }

  public async query<T = unknown>(
    sql: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, values);
  }

  public async transaction<T>(
    fn: (client: Queryable) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async withClient<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  public async ensureSchema(): Promise<void> {
    for (const stmt of canonicalSchemaStatements) {
      await this.pool.query(stmt.sql);
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
