import { readFileSync } from "node:fs";
import { join } from "node:path";

const dataPath = join(import.meta.dir, "../../data/standard_verification_data.json");
const proof = JSON.parse(readFileSync(dataPath, "utf-8"));

console.log(JSON.stringify({ proof: "quantitative_performance", ...proof }, null, 2));
