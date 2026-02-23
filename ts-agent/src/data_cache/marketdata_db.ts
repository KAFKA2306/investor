import { Database } from "bun:sqlite";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { z } from "zod";

const ConfigSchema = z.object({
  rootDir: z.string().min(1),
  dbPath: z.string().min(1),
});

const parseCsvLine = (line: string): string[] => {
  let inQuote = false;
  let cur = "";
  const out: string[] = [];
  for (const ch of line) {
    inQuote = ch === '"' ? !inQuote : inQuote;
    const split = ch === "," && !inQuote;
    if (split) {
      out.push(cur);
      cur = "";
      continue;
    }
    if (ch !== '"') {
      cur = `${cur}${ch}`;
    }
  }
  out.push(cur);
  return out;
};

const headerMap = (line: string): Record<string, number> => {
  const map: Record<string, number> = {};
  parseCsvLine(line).forEach((key, idx) => {
    map[key.trim()] = idx;
  });
  return map;
};

const pick = (
  cols: string[],
  map: Record<string, number>,
  key: string,
): string => cols[map[key] ?? -1] ?? "";
const asIsoDate = (v: string): string =>
  /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
const toCode4 = (code: string): string =>
  /^\d{5}$/.test(code) && code.endsWith("0") ? code.slice(0, 4) : code;
const toCode5 = (code: string): string =>
  /^\d{4}$/.test(code) ? `${code}0` : code;

export type UnifiedRow = {
  source: "stock_list" | "stock_price" | "stock_fin";
  code: string;
  asof: string;
  payload: Record<string, unknown>;
};

export class MarketdataDbCache {
  private readonly db: Database;
  private readonly rootDir: string;
  private readonly files: { list: string; price: string; fin: string };

  constructor(rootDir: string, dbPath: string) {
    const cfg = ConfigSchema.parse({ rootDir, dbPath });
    this.rootDir = resolve(cfg.rootDir);
    const path = resolve(cfg.dbPath);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.files = {
      list: resolve(this.rootDir, "stock_list.csv.gz"),
      price: resolve(this.rootDir, "raw_stock_price.csv.gz"),
      fin: resolve(this.rootDir, "raw_stock_fin.csv.gz"),
    };
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS md_unified (
        source TEXT NOT NULL,
        code TEXT NOT NULL,
        asof TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        PRIMARY KEY (source, code, asof)
      );
      CREATE INDEX IF NOT EXISTS idx_md_unified_source_code_asof ON md_unified(source, code, asof);
    `);
  }

  public assertSourcesReady(): void {
    z.literal(true).parse(
      [this.files.list, this.files.price, this.files.fin].every((f) =>
        existsSync(f),
      ),
    );
  }

  private async ingestGzCsv(
    file: string,
    onRow: (
      header: Record<string, number>,
      cols: string[],
    ) => UnifiedRow | undefined,
  ): Promise<void> {
    const stream = createReadStream(file).pipe(createGunzip());
    const rl = createInterface({
      input: stream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    let header: Record<string, number> | undefined;
    const upsert = this.db.prepare(`
      INSERT INTO md_unified (source, code, asof, payload_json, fetched_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(source, code, asof) DO UPDATE SET
        payload_json = excluded.payload_json,
        fetched_at = excluded.fetched_at
    `);
    const tx = this.db.transaction((rows: UnifiedRow[], fetchedAt: number) => {
      rows.forEach((r) => {
        upsert.run(
          r.source,
          r.code,
          r.asof,
          JSON.stringify(r.payload),
          fetchedAt,
        );
      });
    });
    const bucket: UnifiedRow[] = [];
    const now = Date.now();
    for await (const line of rl) {
      if (header === undefined) {
        header = headerMap(line);
        continue;
      }
      const row = onRow(header, parseCsvLine(line));
      if (row) {
        bucket.push(row);
      }
      if (bucket.length >= 2000) {
        tx([...bucket], now);
        bucket.splice(0, bucket.length);
      }
    }
    if (bucket.length > 0) {
      tx(bucket, now);
    }
  }

  public async ensureLoaded(symbols4: readonly string[]): Promise<void> {
    this.assertSourcesReady();
    const wanted = new Set(symbols4.map((s) => toCode5(s)));
    await this.ingestGzCsv(this.files.list, (h, c) => {
      const code = pick(c, h, "Local Code");
      return wanted.has(code)
        ? {
            source: "stock_list",
            code,
            asof: "0000-00-00",
            payload: {
              LocalCode: toCode4(code),
              NameEnglish: pick(c, h, "Name (English)"),
              SectionProducts: pick(c, h, "Section/Products"),
              Sector33Code: pick(c, h, "33 Sector(Code)"),
              Sector33Name: pick(c, h, "33 Sector(Name)"),
            },
          }
        : undefined;
    });
    await this.ingestGzCsv(this.files.price, (h, c) => {
      const code = pick(c, h, "Code");
      const asof = pick(c, h, "Date");
      return wanted.has(code)
        ? {
            source: "stock_price",
            code,
            asof,
            payload: {
              Code: toCode4(code),
              Date: asof,
              Open: Number(pick(c, h, "Open")) || 0,
              High: Number(pick(c, h, "High")) || 0,
              Low: Number(pick(c, h, "Low")) || 0,
              Close: Number(pick(c, h, "Close")) || 0,
              Volume: Number(pick(c, h, "Volume")) || 0,
              TurnoverValue: Number(pick(c, h, "TurnoverValue")) || 0,
            },
          }
        : undefined;
    });
    await this.ingestGzCsv(this.files.fin, (h, c) => {
      const code = pick(c, h, "LocalCode");
      const asof = pick(c, h, "DisclosedDate");
      return wanted.has(code)
        ? {
            source: "stock_fin",
            code,
            asof,
            payload: {
              LocalCode: toCode4(code),
              DisclosedDate: asof,
              NetSales: Number(pick(c, h, "NetSales")) || 0,
              OperatingProfit: Number(pick(c, h, "OperatingProfit")) || 0,
              OrdinaryProfit: Number(pick(c, h, "OrdinaryProfit")) || 0,
              Profit: Number(pick(c, h, "Profit")) || 0,
            },
          }
        : undefined;
    });
  }

  private rows(
    source: UnifiedRow["source"],
    code5Value: string,
  ): Array<Record<string, unknown>> {
    const recs = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = ?1 AND code = ?2 ORDER BY asof DESC",
      )
      .all(source, code5Value) as Array<{ payload_json: string }>;
    return recs.map((r) =>
      z
        .record(z.string(), z.unknown())
        .catch({})
        .parse(JSON.parse(r.payload_json)),
    );
  }

  public getListedInfo(): Array<Record<string, unknown>> {
    const recs = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_list' ORDER BY code",
      )
      .all() as Array<{ payload_json: string }>;
    return recs.map((r) =>
      z
        .record(z.string(), z.unknown())
        .catch({})
        .parse(JSON.parse(r.payload_json)),
    );
  }

  public getLatestBar(
    symbol4: string,
    dates: readonly string[],
  ): Array<Record<string, unknown>> {
    const sorted = [...dates].map(asIsoDate).sort();
    const from = sorted[0] ?? "";
    const to = sorted[sorted.length - 1] ?? "9999-12-31";
    const rec = this.db
      .query(
        "SELECT payload_json FROM md_unified WHERE source = 'stock_price' AND code = ?1 AND asof >= ?2 AND asof <= ?3 ORDER BY asof DESC LIMIT 1",
      )
      .get(toCode5(symbol4), from, to) as { payload_json: string } | null;
    return rec
      ? [
          z
            .record(z.string(), z.unknown())
            .catch({})
            .parse(JSON.parse(rec.payload_json)),
        ]
      : [];
  }

  public getLatestFin(symbol4: string): Array<Record<string, unknown>> {
    return this.rows("stock_fin", toCode5(symbol4)).slice(0, 1);
  }

  public getLatestAsof(source: UnifiedRow["source"]): string {
    const row = this.db
      .query("SELECT MAX(asof) AS asof FROM md_unified WHERE source = ?1")
      .get(source) as { asof: string | null } | null;
    return row?.asof ?? "";
  }
}
