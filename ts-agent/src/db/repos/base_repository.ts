import type { PostgresClient } from "../postgres_client.ts";

export abstract class BaseRepository<T extends { id: string }> {
  protected readonly db: PostgresClient;
  protected abstract readonly table: string;

  constructor(db: PostgresClient) {
    this.db = db;
  }

  /**
   * オブジェクトを JSON 文字列にかわいく変換するよっ！✨
   */
  protected toJson(val: unknown): string | null {
    if (val === undefined || val === null) return null;
    return JSON.stringify(val);
  }

  public async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.table} WHERE id = $1`;
    const res = await this.db.query(sql, [id]);
    return (res.rows[0] as T) || null;
  }

  public async list(limit = 100): Promise<T[]> {
    const sql = `SELECT * FROM ${this.table} LIMIT $1`;
    const res = await this.db.query(sql, [limit]);
    return res.rows as T[];
  }

  /**
   * 汎用的な UPSERT (INSERT ... ON CONFLICT) を実行するよっ！🛡️✨
   */
  protected async executeUpsert(params: {
    table: string;
    conflictTarget: string | string[];
    data: Record<string, unknown>;
    casts?: Record<string, string>;
  }): Promise<void> {
    const keys = Object.keys(params.data);
    const values = Object.values(params.data);
    const placeholders = keys.map((_, i) => {
      const cast = params.casts?.[keys[i]!]
        ? `::${params.casts[keys[i]!]}`
        : "";
      return `$${i + 1}${cast}`;
    });

    const conflictTarget = Array.isArray(params.conflictTarget)
      ? params.conflictTarget.join(", ")
      : params.conflictTarget;

    const updateSet = keys
      .filter((k) => !params.conflictTarget.includes(k))
      .map((k) => `${k} = EXCLUDED.${k}`)
      .join(", ");

    const sql = `
      INSERT INTO ${params.table} (${keys.join(", ")})
      VALUES (${placeholders.join(", ")})
      ON CONFLICT (${conflictTarget})
      ${updateSet ? `DO UPDATE SET ${updateSet}` : "DO NOTHING"}
    `;

    await this.db.query(sql, values);
  }
}
