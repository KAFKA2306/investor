#!/usr/bin/env bun
/**
 * EDINET Individual Stock Research
 * Extracts and summarizes qualitative information from Securities Reports.
 */
import { join } from "node:path";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { EdinetProvider, bySecCode } from "../src/providers/edinet_provider.ts";
import { EdinetItemizer } from "../src/providers/edinet_itemizer.ts";
import { parseCliArgs, getNumberArg, getStringArg } from "../src/providers/cli_args.ts";
import { toSymbol4 } from "../src/providers/value_normalizers.ts";

async function main() {
    const parsedArgs = parseCliArgs(process.argv.slice(2));
    const rawTicker = parsedArgs.positional[0] ?? getStringArg(parsedArgs, "--ticker");

    if (!rawTicker) {
        console.error("❌ Usage: bun scripts/kobetsu_research.ts <ticker> [--range-days N]");
        process.exit(1);
    }

    const ticker = toSymbol4(rawTicker);
    const rangeDays = Math.max(1, getNumberArg(parsedArgs, "--range-days", 730));
    const secCode5 = `${ticker}0`;

    console.log(`\n🔍 [Research] Starting research for ${ticker} (secCode=${secCode5}) over last ${rangeDays} days...`);

    const edinet = new EdinetProvider();
    const itemizer = new EdinetItemizer();

    const today = new Date();
    const fromDate = new Date(today.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const startDate = fromDate.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    console.log(`📡 [Research] Scanning for reports from ${startDate} to ${endDate}...`);

    const docs = await edinet.getDocumentListRange(startDate, endDate, (doc) => {
        const match = bySecCode(secCode5)(doc);
        if (match) {
            console.log(`🎯 [Research] Match on ${doc.submitDateTime}: ${doc.docID} | ${doc.docDescription}`);
        }
        return match;
    });

    if (docs.length === 0) {
        console.error(`❌ [Research] No Securities Report found for ${ticker} between ${startDate} and ${endDate}.`);
        process.exit(1);
    }

    console.log(`📊 [Research] Found ${docs.length} candidate documents. Evaluating...`);
    for (const d of docs) {
        console.log(`   - ${d.docID} | ${d.submitDateTime} | ${d.docDescription}`);
    }

    const bestDoc = docs.find(d =>
        (d.docDescription?.includes("有価証券報告書") ?? false) &&
        !(d.docDescription?.includes("訂正") ?? false) &&
        !(d.docDescription?.includes("参照") ?? false)
    ) || docs[0]!;

    const latestDoc = bestDoc;

    console.log(`✅ [Research] Selected best report: ${latestDoc.docID} (${latestDoc.submitDateTime})`);
    console.log(`📄 Description: ${latestDoc.docDescription}`);

    const zipPath = await edinet.downloadDocument(latestDoc.docID, 1);
    if (!zipPath) {
        console.error(`❌ [Research] Failed to download XBRL for ${latestDoc.docID}`);
        process.exit(1);
    }

    const tmpDir = join(import.meta.dir, "../tmp", `research_${latestDoc.docID}`);
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    console.log(`🔓 [Research] Unzipping and extracting HTML content...`);

    const stdout = execSync(`unzip -p "${zipPath}" "XBRL/PublicDoc/*.htm"`, { maxBuffer: 50 * 1024 * 1024 }).toString();

    const content = stdout
        .replace(/<[^>]*>?/gm, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (content.length === 0) {
        console.error(`❌ [Research] Extracted content is empty for ${latestDoc.docID}`);
        process.exit(1);
    }

    console.log(`📊 [Research] Extracted ${content.length} characters of raw text.`);

    const debugPath = join(import.meta.dir, "../tmp", "debug_raw_text.txt");
    writeFileSync(debugPath, content.slice(0, 50000));
    console.log(`🔍 [Research] Debug sample saved to ${debugPath}`);

    const segments = itemizer.segment(content);
    console.log(`🧩 [Research] Found ${segments.length} total segments.`);

    const targetSections = [
        "【事業の内容】",
        "【経営方針、経営環境及び対処すべき課題等】",
        "【事業等のリスク】",
        "【経営者による財政状態、経営成績及びキャッシュ・フローの状況の分析】"
    ];

    console.log(`\n================================================================================`);
    console.log(`🏢 RESEARCH SUMMARY: ${latestDoc.filerName} (${ticker})`);
    console.log(`📅 Report Date: ${latestDoc.submitDateTime}`);
    console.log(`================================================================================\n`);

    for (const title of targetSections) {
        const seg = segments.find(s => s.title === title);
        console.log(`${title}`);
        console.log(`────────────────────────────────────────────────────────────────────────────────`);
        if (seg) {
            const text = seg.content.length > 1500 ? seg.content.slice(0, 1500) + "..." : seg.content;
            console.log(text);
        } else {
            console.log("(Section not found in this document)");
        }
        console.log("");
    }

    console.log(`================================================================================`);
    console.log(`✅ [Research] Complete.`);
}

main().catch(console.error);
