import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { core } from "../system/app_runtime_core.ts";
import { EdinetItemizer } from "../utils/edinet_utils.ts";

const unzipListMaxChars = 20 * 1024 * 1024;
const unzipExtractMaxChars = 100 * 1024 * 1024;

const isAllowedZipEntry = (value: string): boolean => {
  if (
    [...value].some((ch) => {
      const code = ch.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return false;
  }
  return (
    value.startsWith("XBRL/PublicDoc/") && value.toLowerCase().endsWith(".htm")
  );
};

const runProcess = async (
  command: string,
  args: string[],
  maxChars: number,
): Promise<string> => {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stdout.length > maxChars) {
    throw new Error(`command output exceeds limit: ${command}`);
  }

  if (exitCode !== 0) {
    throw new Error(
      `command failed: ${command} ${args.join(" ")} :: ${stderr.slice(0, 800)}`,
    );
  }

  return stdout;
};

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
      const listed = await runProcess(
        "unzip",
        ["-Z1", zipPath],
        unzipListMaxChars,
      );
      const targets = listed
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter((v) => isAllowedZipEntry(v));
      let merged = "";
      for (const target of targets) {
        const stdout = await runProcess(
          "unzip",
          ["-p", zipPath, target],
          unzipExtractMaxChars,
        );
        merged += ` ${stdout}`;
      }
      content = merged
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
