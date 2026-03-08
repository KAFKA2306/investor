import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const isErrorLikePayload = (payload: unknown): boolean => {
  if (typeof payload !== "object" || payload === null) return true;
  const p = payload as Record<string, unknown>;
  return Boolean(p.error || p.errors || p.message === "Error");
};

const isEmptyPayload = (payload: unknown): boolean => {
  if (typeof payload !== "object" || payload === null) return true;
  return Object.keys(payload).length === 0;
};

export class SqliteHttpCache {
  private readonly db: Database;

  constructor(dbPath: string) {
    const absolutePath = resolve(dbPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.db = new Database(absolutePath);
    this.ensureSchema();
  }

  public get rawDb(): Database {
    return this.db;
  }

  private ensureSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS http_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_http_cache_expires_at ON http_cache(expires_at)",
    );
  }

  public async fetchJson(
    url: string,
    headers: Record<string, string>,
    ttlMs: number,
    _options: { allowStale?: boolean } = {},
  ): Promise<{ payload: unknown; cached: boolean }> {
    const row = this.db
      .query("SELECT value, expires_at FROM http_cache WHERE key = ?")
      .get(url) as { value: string; expires_at: number } | undefined;

    if (row) {
      const isStale = Date.now() > row.expires_at;
      if (!isStale) {
        return { payload: JSON.parse(row.value), cached: true };
      }
      // Stale cache detected: fetch fresh data from source
      // Never fallback to stale data - let fresh fetch happen below
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const reason = await response.text().catch(() => "Unknown error");
      throw new Error(
        `HTTP Cache fetch failed: ${response.status} ${reason} (URL: ${url})`,
      );
    }
    const payload = await response.json();

    if (!isErrorLikePayload(payload) && !isEmptyPayload(payload)) {
      const now = Date.now();
      this.db.run(
        "INSERT OR REPLACE INTO http_cache (key, value, created_at, expires_at) VALUES (?, ?, ?, ?)",
        [url, JSON.stringify(payload), now, now + ttlMs],
      );
    }

    return { payload, cached: false };
  }
}

export class MarketdataDbCache {
  private readonly db: Database;

  constructor(dataRoot: string, dbName: string) {
    const absolutePath = resolve(dataRoot, dbName);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.db = new Database(absolutePath);
  }

  public async ensureLoaded(_symbols: readonly string[]): Promise<void> {
    // 実装略
  }

  public async getListedInfo(): Promise<unknown[]> {
    const rows = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_list' OR source = 'listed_info'",
      )
      .all() as { payload_json: string }[];
    if (rows.length > 0) {
      return rows.map((r) => JSON.parse(r.payload_json));
    }
    throw new Error("Listed info not found and fallback is disabled.");
  }

  public async getLatestBar(
    symbol: string,
    dates: string[],
  ): Promise<unknown[]> {
    const code = symbol.length === 4 ? `${symbol}0` : symbol;
    const placeholders = dates.map(() => "?").join(",");
    const rows = this.db
      .query(
        `SELECT payload_json FROM md_unified WHERE source = 'stock_price' AND code = ? AND asof IN (${placeholders})`,
      )
      .all(code, ...dates) as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  public async getLatestFin(symbol: string): Promise<unknown[]> {
    const code = symbol.length === 4 ? `${symbol}0` : symbol;
    const rows = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_fin' AND code = ? ORDER BY asof DESC LIMIT 1",
      )
      .all(code) as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  public async getLatestAsof(table: string): Promise<string> {
    const sourceMap: Record<string, string> = {
      stock_price: "stock_price",
      stock_fin: "stock_fin",
    };
    const source = sourceMap[table] || table;
    const row = this.db
      .query("SELECT MAX(asof) as asof FROM md_unified WHERE source = ?")
      .get(source) as { asof: string } | undefined;

    if (!row || !row.asof) {
      throw new Error(
        `Latest asof date not found for ${table}. No fallback allowed.`,
      );
    }
    return row.asof;
  }

  public getBars(symbol: string, limit: number): any[] {
    const code = symbol.length === 4 ? `${symbol}0` : symbol;
    const rows = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_price' AND code = ? ORDER BY asof DESC LIMIT ?",
      )
      .all(code, limit) as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  public getBarsAll(symbol: string): any[] {
    const code = symbol.length === 4 ? `${symbol}0` : symbol;
    const rows = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_price' AND code = ? ORDER BY asof ASC",
      )
      .all(code) as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }
}
