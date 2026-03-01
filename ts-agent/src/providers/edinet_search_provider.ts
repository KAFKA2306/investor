import { Database } from "bun:sqlite";
import { exec as execCb } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { core } from "../system/app_runtime_core.ts";
import { EdinetItemizer } from "./edinet_itemizer.ts";

const exec = promisify(execCb);

export class EdinetSearchProvider {
  private readonly dbPath: string;
  private readonly docsDir: string;
  private db: Database;
  private itemizer: EdinetItemizer;

  constructor() {
    this.dbPath = join(core.config.paths.logs, "cache", "edinet_search.sqlite");
    this.docsDir = join(core.config.paths.logs, "cache", "edinet_docs");
    this.db = new Database(this.dbPath, { create: true });
    this.itemizer = new EdinetItemizer();
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS edinet_search USING fts5(
        docID UNINDEXED,
        secCode UNINDEXED,
        filerName,
        docDescription,
        sectionName,
        content,
        tokenize='unicode61'
      );

      CREATE TABLE IF NOT EXISTS indexed_docs (
        docID TEXT PRIMARY KEY,
        indexed_at TEXT NOT NULL
      );
    `);
  }

  public async indexDocument(
    docID: string,
    secCode?: string,
    filerName?: string,
    docDescription?: string,
  ): Promise<void> {
    const indexed = this.db
      .query("SELECT 1 FROM indexed_docs WHERE docID = ?")
      .get(docID);
    if (indexed) return;

    const zipPath = join(this.docsDir, `${docID}_type1.zip`);
    let content = "";

    if (existsSync(zipPath)) {
      const { stdout } = await exec(
        `unzip -p "${zipPath}" "XBRL/PublicDoc/*.htm"`,
        { maxBuffer: 100 * 1024 * 1024 },
      );
      content = stdout
        .replace(/<[^>]*>?/gm, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (content.length === 0) {
      const fallback = [filerName, docDescription].filter(Boolean).join(" ");
      content = fallback.trim();
    }

    if (content.length === 0) {
      this.db
        .query(
          "INSERT OR IGNORE INTO indexed_docs (docID, indexed_at) VALUES (?, ?)",
        )
        .run(docID, new Date().toISOString());
      return;
    }

    const sections = this.itemizer.segment(content);
    const rows: Array<{ sectionName: string; content: string }> =
      sections.length > 0
        ? sections.map((section) => ({
            sectionName: section.title,
            content: section.content,
          }))
        : [{ sectionName: "全文", content }];

    const insert = this.db.prepare(`
      INSERT INTO edinet_search
      (docID, secCode, filerName, docDescription, sectionName, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(
      (payload: Array<{ sectionName: string; content: string }>): void => {
        for (const row of payload) {
          insert.run(
            docID,
            secCode ?? null,
            filerName ?? null,
            docDescription ?? null,
            row.sectionName,
            row.content,
          );
        }
        this.db
          .query(
            "INSERT OR IGNORE INTO indexed_docs (docID, indexed_at) VALUES (?, ?)",
          )
          .run(docID, new Date().toISOString());
      },
    );
    tx(rows);
  }

  public search(
    query: string,
    limit = 10,
  ): {
    docID: string;
    secCode: string | null;
    filerName: string | null;
    docDescription: string | null;
    sectionName: string;
    rank: number;
  }[] {
    const stmt = this.db.prepare(`
      SELECT docID, secCode, filerName, docDescription, sectionName, bm25(edinet_search) as rank
      FROM edinet_search
      WHERE edinet_search MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(query, limit) as {
      docID: string;
      secCode: string | null;
      filerName: string | null;
      docDescription: string | null;
      sectionName: string;
      rank: number;
    }[];
  }

  public close(): void {
    this.db.close();
  }
}
