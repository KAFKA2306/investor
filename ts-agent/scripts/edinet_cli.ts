#!/usr/bin/env bun
/**
 * EDINET CLI — 使いやすいコマンドラインツール
 *
 * Usage:
 *   bun run edinet stats              DB統計
 *   bun run edinet list <date>        書類一覧
 *   bun run edinet search <code>      銘柄コード検索 (直近30日)
 *   bun run edinet download <id> [t]  書類ダウンロード (type=1..5, default=5)
 *   bun run edinet fix-ttl            過去日付のTTLを永久に修正
 *   bun run edinet vacuum             DB最適化
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// ─── Config ──────────────────────────────────────────────────────────────
const DB_PATH = resolve(
    import.meta.dir,
    "../../logs/cache/edinet_cache.sqlite",
);
const DOCS_DIR = resolve(import.meta.dir, "../../logs/cache/edinet_docs");
const PERMANENT_TTL_MS = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

const jstToday = () =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmt = (bytes: number): string => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
};

const printTable = (
    rows: Record<string, unknown>[],
    cols: string[],
): void => {
    if (rows.length === 0) {
        console.log("  (no results)");
        return;
    }
    // Compute column widths
    const widths = cols.map((c) =>
        Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
    );
    const header = cols.map((c, i) => c.padEnd(widths[i]!)).join("  ");
    const separator = widths.map((w) => "─".repeat(w)).join("──");
    console.log(`  ${header}`);
    console.log(`  ${separator}`);
    for (const row of rows) {
        const line = cols
            .map((c, i) => String(row[c] ?? "").padEnd(widths[i]!))
            .join("  ");
        console.log(`  ${line}`);
    }
};

const ensureDb = (): Database => {
    if (!existsSync(DB_PATH)) {
        console.error(`❌ DB not found: ${DB_PATH}`);
        process.exit(1);
    }
    return new Database(DB_PATH);
};

// ─── Commands ────────────────────────────────────────────────────────────

async function cmdStats(): Promise<void> {
    const db = ensureDb();
    const { total } = db
        .query("SELECT COUNT(*) as total FROM http_cache")
        .get() as { total: number };
    const { payload_mb } = db
        .query(
            "SELECT ROUND(SUM(LENGTH(value))/1024.0/1024.0, 2) as payload_mb FROM http_cache",
        )
        .get() as { payload_mb: number };
    const { oldest, newest } = db
        .query(
            "SELECT datetime(MIN(created_at)/1000, 'unixepoch', '+9 hours') as oldest, datetime(MAX(created_at)/1000, 'unixepoch', '+9 hours') as newest FROM http_cache",
        )
        .get() as { oldest: string; newest: string };
    const { perm, short } = db
        .query(
            `SELECT
        SUM(CASE WHEN (expires_at - created_at) > 86400000 THEN 1 ELSE 0 END) as perm,
        SUM(CASE WHEN (expires_at - created_at) <= 86400000 THEN 1 ELSE 0 END) as short
      FROM http_cache`,
        )
        .get() as { perm: number; short: number };
    const { expired } = db
        .query(
            `SELECT COUNT(*) as expired FROM http_cache WHERE expires_at < ${Date.now()}`,
        )
        .get() as { expired: number };

    console.log(`\n📊 EDINET Cache Stats`);
    console.log(`  Rows:        ${total}`);
    console.log(`  Payload:     ${payload_mb} MB`);
    console.log(`  DB file:     ${DB_PATH}`);
    console.log(`  Created:     ${oldest} ~ ${newest} (JST)`);
    console.log(`  TTL perm:    ${perm}   short(≤24h): ${short}`);
    console.log(`  Expired:     ${expired}`);

    // Date distribution (top 10 months)
    const months = db
        .query(
            `SELECT
        SUBSTR(json_extract(key, '$.url'), INSTR(json_extract(key, '$.url'), 'date=') + 5, 7) as month,
        COUNT(*) as entries,
        ROUND(SUM(LENGTH(value))/1024.0/1024.0, 1) as mb
      FROM http_cache
      GROUP BY month
      ORDER BY month DESC
      LIMIT 10`,
        )
        .all() as Array<{ month: string; entries: number; mb: number }>;

    console.log(`\n  Recent months:`);
    printTable(months, ["month", "entries", "mb"]);

    // Docs dir
    if (existsSync(DOCS_DIR)) {
        const files = new Bun.Glob("*").scanSync(DOCS_DIR);
        const docFiles = [...files];
        console.log(`\n  Downloaded docs: ${docFiles.length} files in ${DOCS_DIR}`);
    }
    console.log("");
    db.close();
}

async function cmdList(date: string): Promise<void> {
    // Dynamic import to trigger core init
    const { EdinetProvider } = await import(
        "../src/providers/edinet_provider.ts"
    );
    const edinet = new EdinetProvider();
    const response = await edinet.getDocumentList(date, 2);

    console.log(
        `\n📋 ${date} — ${response.metadata.resultset.count} documents\n`,
    );

    // Summary by docTypeCode
    const byType = new Map<string, number>();
    for (const doc of response.results) {
        const key = doc.docTypeCode ?? "null";
        byType.set(key, (byType.get(key) ?? 0) + 1);
    }

    const typeLabels: Record<string, string> = {
        "030": "有価証券報告書",
        "043": "四半期報告書",
        "050": "半期報告書",
        "140": "決算短信",
    };

    console.log("  Document types:");
    for (const [code, count] of [...byType.entries()].sort()) {
        const label = typeLabels[code] ?? "";
        console.log(`    ${code}: ${count} ${label}`);
    }

    // Show first 20 with secCode
    const withCode = response.results.filter(
        (d) => d.secCode && d.secCode.trim().length > 0,
    );
    console.log(`\n  With secCode: ${withCode.length} documents`);

    if (withCode.length > 0) {
        const rows = withCode.slice(0, 20).map((d) => ({
            docID: d.docID,
            secCode: d.secCode ?? "",
            type: d.docTypeCode ?? "",
            filer: (d.filerName ?? "").slice(0, 24),
            desc: (d.docDescription ?? "").slice(0, 30),
        }));
        printTable(rows, ["docID", "secCode", "type", "filer", "desc"]);
        if (withCode.length > 20) {
            console.log(`  ... and ${withCode.length - 20} more`);
        }
    }
    console.log("");
}

async function cmdSearch(secCode: string, rangeDays: number = 30, endOffset: number = 0): Promise<void> {
    const { EdinetProvider, bySecCode } = await import(
        "../src/providers/edinet_provider.ts"
    );
    const edinet = new EdinetProvider();

    // Normalize to 5-digit
    const code5 = secCode.length === 4 ? `${secCode}0` : secCode;

    console.log(`\n🔍 Searching for secCode=${code5} (${rangeDays} days, endOffset=${endOffset})...\n`);

    const results: Array<{
        date: string;
        docID: string;
        type: string;
        desc: string;
    }> = [];

    const today = new Date();
    const endDate = new Date(today.getTime() - endOffset * 24 * 60 * 60 * 1000);

    for (let i = 0; i < rangeDays; i++) {
        const d = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

        try {
            const docs = await edinet.getFilteredDocuments(dateStr, bySecCode(code5));
            for (const doc of docs) {
                results.push({
                    date: dateStr,
                    docID: doc.docID,
                    type: doc.docTypeCode ?? "",
                    desc: (doc.docDescription ?? "").slice(0, 40),
                });
            }
        } catch {
            // skip
        }
        // Minimal delay if not hit cache? No, EdinetProvider handles it.
    }

    if (results.length === 0) {
        console.log(`  No documents found in the requested range.`);
    } else {
        printTable(results, ["date", "docID", "type", "desc"]);
    }
    console.log("");
}

async function cmdDownload(docID: string, type: number): Promise<void> {
    const { EdinetProvider } = await import(
        "../src/providers/edinet_provider.ts"
    );
    const edinet = new EdinetProvider();

    const validTypes = [1, 2, 3, 4, 5] as const;
    if (!validTypes.includes(type as (typeof validTypes)[number])) {
        console.error(`❌ Invalid type: ${type}. Must be 1-5.`);
        process.exit(1);
    }

    const path = await edinet.downloadDocument(
        docID,
        type as (typeof validTypes)[number],
    );
    if (path) {
        console.log(`\n✅ Downloaded: ${path}\n`);
    } else {
        console.error(`\n❌ Download failed for ${docID} type=${type}\n`);
        process.exit(1);
    }
}

function cmdFixTtl(): void {
    const db = ensureDb();
    const today = jstToday();

    // Count rows that need fixing (not today + short TTL)
    const { count } = db
        .query(
            `SELECT COUNT(*) as count FROM http_cache
       WHERE json_extract(key, '$.url') NOT LIKE '%date=${today}%'
         AND (expires_at - created_at) <= 86400000`,
        )
        .get() as { count: number };

    if (count === 0) {
        console.log("\n✅ All past dates already have permanent TTL.\n");
        db.close();
        return;
    }

    console.log(`\n🔧 Fixing ${count} rows with short TTL → permanent...`);

    const result = db
        .query(
            `UPDATE http_cache
       SET expires_at = created_at + ${PERMANENT_TTL_MS}
       WHERE json_extract(key, '$.url') NOT LIKE '%date=${today}%'
         AND (expires_at - created_at) <= 86400000`,
        )
        .run();

    console.log(`✅ Updated ${result.changes} rows.`);

    // Verify
    const { perm, short } = db
        .query(
            `SELECT
        SUM(CASE WHEN (expires_at - created_at) > 86400000 THEN 1 ELSE 0 END) as perm,
        SUM(CASE WHEN (expires_at - created_at) <= 86400000 THEN 1 ELSE 0 END) as short
      FROM http_cache`,
        )
        .get() as { perm: number; short: number };

    console.log(`  TTL permanent: ${perm}  short: ${short}\n`);
    db.close();
}

function cmdVacuum(): void {
    const db = ensureDb();
    const countRow = db
        .query("PRAGMA page_count")
        .get() as { page_count: number } | null;
    const sizeRow = db
        .query("PRAGMA page_size")
        .get() as { page_size: number } | null;
    const before = (countRow?.page_count ?? 0) * (sizeRow?.page_size ?? 4096);

    console.log(`\n🗜  Before: ${fmt(before)}`);
    console.log("  Running VACUUM...");
    db.exec("VACUUM");

    const afterRow = db
        .query("PRAGMA page_count")
        .get() as { page_count: number } | null;
    const after = (afterRow?.page_count ?? 0) * (sizeRow?.page_size ?? 4096);
    console.log(`  After:  ${fmt(after)}`);
    console.log(
        `  Saved:  ${fmt(before - after)} (${(((before - after) / before) * 100).toFixed(1)}%)\n`,
    );
    db.close();
}

function printUsage(): void {
    console.log(`
EDINET CLI — 📡 金融庁電子開示システム

Usage:
  bun run edinet stats                 DB統計
  bun run edinet list <YYYY-MM-DD>     指定日の書類一覧
  bun run edinet search <code>         銘柄コード検索 (直近30日)
  bun run edinet download <docID> [t]  書類ダウンロード (type 1-5, default: 5)
  bun run edinet fix-ttl               過去日付のTTLを永久に修正
  bun run edinet vacuum                DB最適化 (VACUUM)

Examples:
  bun run edinet list 2026-02-27
  bun run edinet search 6501            # 日立
  bun run edinet download S100XL1J 5    # CSV
`);
}

// ─── Main ────────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
    case "stats":
        await cmdStats();
        break;
    case "list":
        if (!args[0]) {
            console.error("❌ Usage: bun run edinet list <YYYY-MM-DD>");
            process.exit(1);
        }
        await cmdList(args[0]);
        break;
    case "search":
        if (!args[0]) {
            console.error("❌ Usage: bun run edinet search <secCode>");
            process.exit(1);
        }
        await cmdSearch(args[0]);
        break;
    case "download":
        if (!args[0]) {
            console.error("❌ Usage: bun run edinet download <docID> [type]");
            process.exit(1);
        }
        await cmdDownload(args[0], Number(args[1] ?? 5));
        break;
    case "fix-ttl":
        cmdFixTtl();
        break;
    case "vacuum":
        cmdVacuum();
        break;
    default:
        printUsage();
        break;
}
