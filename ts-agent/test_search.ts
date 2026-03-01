import { EdinetSearchProvider } from "./src/providers/edinet_search_provider.ts";

async function testSearch() {
    const search = new EdinetSearchProvider();
    const query = "リスク"; // Risk
    console.log(`🔍 Searching for: "${query}"...`);

    const results = search.search(query, 5);
    console.log(`Found ${results.length} results:`);

    for (const r of results) {
        console.log(`🏆 RANK: ${r.rank.toFixed(4)} | ${r.docID} | ${r.filerName} | ${r.docDescription}`);
    }

    search.close();
}

testSearch().catch(console.error);
