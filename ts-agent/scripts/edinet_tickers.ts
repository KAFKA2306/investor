/**
 * EDINET 全銘柄ティッカー抽出スクリプト (10年分)
 * 週次サンプリングで全ユニーク証券コードを網羅的に抽出
 */
import { EdinetProvider } from "../src/providers/edinet_provider.ts";

const edinet = new EdinetProvider();
const uniqueTickers = new Map<
    string,
    { filerName: string; edinetCode: string; firstSeen: string; lastSeen: string; filingCount: number }
>();

const today = new Date();
const YEARS = 10;
const SAMPLE_INTERVAL_DAYS = 7; // 週次サンプリング
const totalDays = YEARS * 365;
const totalSamples = Math.ceil(totalDays / SAMPLE_INTERVAL_DAYS);

process.stderr.write(`📊 Scanning ${YEARS} years (${totalSamples} weekly samples)...\n`);

let scanned = 0;
let totalDocs = 0;
let errors = 0;

for (let i = 0; i < totalSamples; i++) {
    const d = new Date(today.getTime() - (i * SAMPLE_INTERVAL_DAYS + 1) * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    try {
        const r = await edinet.getDocumentList(dateStr, 2);
        totalDocs += r.metadata.resultset.count;

        for (const doc of r.results) {
            if (doc.secCode && doc.secCode.trim().length > 0) {
                const code4 = doc.secCode.slice(0, 4);
                const existing = uniqueTickers.get(code4);
                if (existing) {
                    existing.filingCount++;
                    if (dateStr < existing.firstSeen) existing.firstSeen = dateStr;
                    if (dateStr > existing.lastSeen) existing.lastSeen = dateStr;
                } else {
                    uniqueTickers.set(code4, {
                        filerName: doc.filerName ?? "",
                        edinetCode: doc.edinetCode ?? "",
                        firstSeen: dateStr,
                        lastSeen: dateStr,
                        filingCount: 1,
                    });
                }
            }
        }
        scanned++;

        if (scanned % 50 === 0) {
            process.stderr.write(
                `📡 ${scanned}/${totalSamples} | ${dateStr} | ${uniqueTickers.size} tickers | ${totalDocs} docs\n`,
            );
        }
    } catch (e) {
        errors++;
    }

    // Rate limit: 300ms between calls
    await new Promise((r) => setTimeout(r, 300));
}

// Sort and output
const sorted = [...uniqueTickers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`\n=== EDINET 銘柄ユニバース (${YEARS}年分 / 週次サンプリング) ===`);
console.log(`Total unique tickers: ${sorted.length}`);
console.log(`Total documents scanned: ${totalDocs}`);
console.log(`Samples: ${scanned} / ${totalSamples} (errors: ${errors})`);
console.log(`Period: ${sorted.length > 0 ? sorted[0]![1].firstSeen : "N/A"} ~ ${new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`);
console.log("");
console.log("Code\tTicker\tName\tEDINET\tFirst\tLast\tFilings");
for (const [code4, info] of sorted) {
    console.log(
        `${code4}\t${code4}.T\t${info.filerName}\t${info.edinetCode}\t${info.firstSeen}\t${info.lastSeen}\t${info.filingCount}`,
    );
}

process.exit(0);
