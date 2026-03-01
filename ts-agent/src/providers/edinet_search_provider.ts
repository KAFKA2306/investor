import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { core } from "../system/app_runtime_core.ts";
import { EdinetItemizer } from "./edinet_itemizer.ts";

/**
 * EdinetSearchProvider
 *
 * Implements BM25 search over EDINET documents using SQLite FTS5.
 */
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

  /**
   * Index a single document if it exists in the docsDir
   * Currently supports crude extraction from ZIP files
   */
  public async indexDocument(
    docID: string,
    secCode?: string,
    filerName?: string,
    docDescription?: string,
  ): Promise<void> {
    const isAlreadyIndexed = this.db
      .query("SELECT 1 FROM indexed_docs WHERE docID = ?")
      .get(docID);
    if (isAlreadyIndexed) return;

    const zipPath = join(this.docsDir, `${docID}_type1.zip`);

    let content = "";

    if (existsSync(zipPath)) {
      try {
        // Get list of HTM files in PublicDoc
        const stdout = await new Promise<string>((resolve, reject) => {
          const { exec } = require("node:child_process");
          exec(
            `unzip -p "${zipPath}" "XBRL/PublicDoc/*.htm"`,
            { maxBuffer: 50 * 1024 * 1024 },
            (err: Error | null, stdout: string) => {
              if (err) reject(err);
              else resolve(stdout);
            },
          );
        });

        // Simple HTML stripping
        content = stdout
          .replace(/<[^>]*>?/gm, " ") // Remove tags
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();

        console.log(
          `📄 [EdinetSearch] Extracted ${content.length} chars from ${docID}`,
        );
      } catch (e) {
        console.error(
          `❌ [EdinetSearch] Failed to extract from ${zipPath}: ${e}`,
        );
      }
    }

    if (content.length > 0) {
      const segments = this.itemizer.segment(content);

      if (segments.length > 0) {
        const stmt = this.db.prepare(
          "INSERT INTO edinet_search (docID, secCode, filerName, docDescription, sectionName, content) VALUES (?, ?, ?, ?, ?, ?)",
        );
        for (const seg of segments) {
          stmt.run(
            docID,
            secCode || null,
            filerName || null,
            docDescription || null,
            seg.title,
            seg.content,
          );
        }
      } else {
        // Fallback for documents without standard sections
        this.db.run(
          "INSERT INTO edinet_search (docID, secCode, filerName, docDescription, sectionName, content) VALUES (?, ?, ?, ?, ?, ?)",
          [
            docID,
            secCode || null,
            filerName || null,
            docDescription || null,
            "FULL_TEXT",
            content,
          ],
        );
      }

      this.db.run(
        "INSERT INTO indexed_docs (docID, indexed_at) VALUES (?, ?)",
        [docID, new Date().toISOString()],
      );
      console.log(
        `✅ [EdinetSearch] Indexed document ${docID} with ${segments.length} segments`,
      );
    }
  }

  /**
   * Perform BM25 search
   */
  public search(
    query: string,
    limit: number = 10,
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
