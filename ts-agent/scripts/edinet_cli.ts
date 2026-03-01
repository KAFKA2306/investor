#!/usr/bin/env bun
/**
 * EDINET CLI — 使いやすいコマンドラインツール
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { parseCliArgs, getNumberArg, getStringArg } from "../src/providers/cli_args.ts";
import { toIsoDate } from "../src/providers/value_normalizers.ts";

// ─── Config ──────────────────────────────────────────────────────────────
const DB_PATH = resolve(
    import.meta.dir,
    "../../logs/cache/edinet_cache.sqlite",
);
const DOCS_DIR = resolve(import.meta.dir, "../../logs/cache/edinet_docs");
const PERMANENT_TTL_MS = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

const jstToday = () =>
    new Date().toISOString().slice(0, 10);

// ─── Helpers ─────────────────────────────────────────────────────────────
const printTable = (
    rows: Record<string, unknown>[],
    cols: string[],
): void => {
    if (rows.length === 0) {
        console.log("  (no results)");
        return;
    }
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
        throw new Error(`DB not found: ${DB_PATH}`);
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

    if (existsSync(DOCS_DIR)) {
        const files = new Bun.Glob("*").scanSync(DOCS_DIR);
        const docFiles = [...files];
        console.log(`\n  Downloaded docs: ${docFiles.length} files in ${DOCS_DIR}`);
    }
    console.log("");
    db.close();
}

async function cmdList(date: string): Promise<void> {
    const { EdinetProvider } = await import(
        "../src/providers/edinet_provider.ts"
    );
    const edinet = new EdinetProvider();
    const response = await edinet.getDocumentList(date, 2);

    console.log(
        `\n📋 ${date} — ${response.metadata.resultset.count} documents\n`,
    );

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

async function cmdSearch(secCode: string, rangeDays: number = 30): Promise<void> {
    const { EdinetProvider, bySecCode } = await import(
        "../src/providers/edinet_provider.ts"
    );
    const edinet = new EdinetProvider();
    const code5 = secCode.length === 4 ? `${secCode}0` : secCode;

    console.log(`\n🔍 Searching for secCode=${code5} (${rangeDays} days)...\n`);

    const results: Array<{
        date: string;
        docID: string;
        type: string;
        desc: string;
    }> = [];

    const today = new Date();
    for (let i = 0; i < rangeDays; i++) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().slice(0, 10);
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
        } catch { /* skip */ }
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
        throw new Error(`Invalid type: ${type}. Must be 1-5.`);
    }
    const path = await edinet.downloadDocument(docID, type as (typeof validTypes)[number]);
    if (path) {
        console.log(`\n✅ Downloaded: ${path}\n`);
    } else {
        throw new Error(`Download failed for ${docID} type=${type}`);
    }
}

function cmdFixTtl(): void {
    const db = ensureDb();
    const today = jstToday();
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

    const result = db
        .query(
            `UPDATE http_cache
       SET expires_at = created_at + ${PERMANENT_TTL_MS}
       WHERE json_extract(key, '$.url') NOT LIKE '%date=${today}%'
         AND (expires_at - created_at) <= 86400000`,
        )
        .run();

    console.log(`✅ Updated ${result.changes} rows.`);
    db.close();
}

function cmdVacuum(): void {
    const db = ensureDb();
    console.log("  Running VACUUM...");
    db.exec("VACUUM");
    console.log("✅ Vacuum complete.\n");
    db.close();
}

function printUsage(): void {
    console.log(`
EDINET CLI — 📡 金融庁電子開示システム

Usage:
  bun run edinet stats                 DB統計
  bun run edinet list --date YYYY-MM-DD 指定日の書類一覧
  bun run edinet search --code TICKER  銘柄コード検索 (直近30日)
  bun run edinet download --id DOCID   書類ダウンロード
  bun run edinet fix-ttl               過去日付のTTLを永久に修正
  bun run edinet vacuum                DB最適化 (VACUUM)
`);
}

// ─── Main ────────────────────────────────────────────────────────────────
async function runCli() {
    const parsed = parseCliArgs(process.argv.slice(2));
    const cmd = parsed.positional[0];

    switch (cmd) {
        case "stats":
            await cmdStats();
            break;
        case "list": {
            const date = getStringArg(parsed, "--date") || parsed.positional[1];
            if (!date) throw new Error("Usage: edinet list --date <YYYY-MM-DD>");
            await cmdList(toIsoDate(date)!);
            break;
        }
        case "search": {
            const code = getStringArg(parsed, "--code") || parsed.positional[1];
            if (!code) throw new Error("Usage: edinet search --code <secCode>");
            await cmdSearch(code, getNumberArg(parsed, "--range-days", 30));
            break;
        }
        case "download": {
            const id = getStringArg(parsed, "--id") || parsed.positional[1];
            if (!id) throw new Error("Usage: edinet download --id <docID>");
            await cmdDownload(id, getNumberArg(parsed, "--type", 5));
            break;
        }
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
}

runCli().catch((e) => {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
});
