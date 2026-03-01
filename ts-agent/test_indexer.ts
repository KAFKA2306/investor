import { EdinetProvider } from "./src/providers/edinet_provider.ts";
import { EdinetSearchProvider } from "./src/providers/edinet_search_provider.ts";

async function runIndexer() {
    const edinet = new EdinetProvider();
    const search = new EdinetSearchProvider();

    const date = "2026-02-13";
    console.log(`🗂  Indexing documents for ${date}...`);

    const docs = await edinet.getDocumentList(date, 2);
    // Filter to Annual Reports (030) or Semi-annual (160) for richer text
    const targets = docs.results.filter(d => d.docTypeCode === "030" || d.docTypeCode === "160").slice(0, 5);

    for (const doc of targets) {
        console.log(`📥 Downloading and indexing ${doc.docID} (${doc.filerName})...`);
        const path = await edinet.downloadDocument(doc.docID, 1);
        if (path) {
            await search.indexDocument(doc.docID, doc.secCode ?? undefined, doc.filerName ?? undefined, doc.docDescription ?? undefined);
        }
    }

    search.close();
    console.log("🏁 Indexing completed.");
}

runIndexer().catch(console.error);
