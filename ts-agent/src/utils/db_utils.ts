import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * SQLiteデータベースを指定のパスに可愛く作成するよっ！🗄️
 */
export function createDb(
  path: string,
  options: { readonly?: boolean; create?: boolean } = { create: true },
): Database {
  const absolutePath = resolve(path);
  if (options.create) {
    mkdirSync(dirname(absolutePath), { recursive: true });
  }
  return new Database(absolutePath, options);
}

/**
 * 共通のHTTPキャッシュから値を取得するよっ！🔍
 */
export function getHttpCacheValue<T>(
  db: Database,
  keyPattern: string,
): { key: string; value: T }[] {
  const rows = db
    .query("SELECT key, value FROM http_cache WHERE key LIKE ?")
    .all(`%${keyPattern}%`) as Array<{ key: string; value: string }>;

  return rows.map((row) => ({
    key: row.key,
    value: JSON.parse(row.value) as T,
  }));
}

/**
 * テーブルの行数をカウントするよっ！🗄️✨
 */
export function countRows(db: Database, table: string, where?: string): number {
  const query = where
    ? `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`
    : `SELECT COUNT(*) as count FROM ${table}`;

  const row = db.query(query).get() as { count: number } | null;
  return Number(row?.count ?? 0);
}

// ── 公開 API ─────────────────────────────────────────────────────────────
// 個別の関数を export しているので、この dbUtils オブジェクトは廃止するよっ！✨
