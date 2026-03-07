import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "investor-smoke-universe-"));
const dataRoot = join(root, "data");
const logsRoot = join(root, "logs");
const verificationRoot = join(root, "verification");
const cacheRoot = join(root, "cache");
const edinetRoot = join(root, "edinet");
const preprocessedRoot = join(root, "preprocessed");

for (const dir of [
  dataRoot,
  logsRoot,
  verificationRoot,
  cacheRoot,
  edinetRoot,
  preprocessedRoot,
]) {
  mkdirSync(dir, { recursive: true });
}

writeFileSync(
  join(dataRoot, "stock_list.csv"),
  [
    "Local Code,prediction_target,universe_comp2",
    "1301,TRUE,TRUE",
    "1332,TRUE,TRUE",
    "7203,FALSE,TRUE",
  ].join("\n"),
  "utf8",
);

process.env.UQTL_DATA_ROOT = dataRoot;
process.env.UQTL_LOGS_ROOT = logsRoot;
process.env.UQTL_VERIFICATION_ROOT = verificationRoot;
process.env.UQTL_CACHE_ROOT = cacheRoot;
process.env.UQTL_EDINET_ROOT = edinetRoot;
process.env.UQTL_PREPROCESSED_ROOT = preprocessedRoot;

const { DataPipelineRuntime } = await import(
  "../../system/data_pipeline_runtime.ts"
);

const runtime = new DataPipelineRuntime();
const universe = runtime.resolveUniverse([], 2);

if (universe.length !== 2 || universe[0] !== "1301" || universe[1] !== "1332") {
  throw new Error(`unexpected dynamic universe: ${JSON.stringify(universe)}`);
}

console.log(JSON.stringify({ ok: true, universe }, null, 2));
