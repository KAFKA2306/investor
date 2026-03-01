import { readFileSync } from "node:fs";
import { join } from "node:path";

const govPath = join(process.cwd(), "data", "edinet_governance_map.json");
const data = JSON.parse(readFileSync(govPath, "utf8"));

const symbols: { ticker: string; corrections: number }[] = [];

for (const ticker of Object.keys(data)) {
    let count = 0;
    for (const date of Object.keys(data[ticker])) {
        if (data[ticker][date].corrections > 0) {
            count += data[ticker][date].corrections;
        }
    }
    if (count > 0) {
        symbols.push({ ticker, corrections: count });
    }
}

symbols.sort((a, b) => b.corrections - a.corrections);
console.log("Top 20 symbols with corrections:");
console.log(JSON.stringify(symbols.slice(0, 20), null, 2));
