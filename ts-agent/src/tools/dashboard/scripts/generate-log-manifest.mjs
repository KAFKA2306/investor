import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const distLogsDir = process.argv[2];

if (!distLogsDir) {
  throw new Error(
    "Usage: node scripts/generate-log-manifest.mjs <dist-logs-dir>",
  );
}

const files = (await readdir(distLogsDir))
  .filter((f) => /^\d{8}\.json$/.test(f))
  .sort();

await writeFile(
  join(distLogsDir, "manifest.json"),
  `${JSON.stringify(files, null, 2)}\n`,
  "utf-8",
);
