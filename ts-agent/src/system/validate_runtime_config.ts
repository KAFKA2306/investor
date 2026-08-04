import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const requiredRoots = [
  "UQTL_DATA_ROOT",
  "UQTL_LOGS_ROOT",
  "UQTL_CACHE_ROOT",
  "UQTL_VERIFICATION_ROOT",
  "UQTL_EDINET_ROOT",
  "UQTL_PREPROCESSED_ROOT",
] as const;

const failures: string[] = [];

for (const name of requiredRoots) {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is not set`);
    continue;
  }
  if (!isAbsolute(value)) {
    failures.push(`${name} must be an absolute path: ${value}`);
    continue;
  }
  try {
    if (!statSync(value).isDirectory()) {
      failures.push(`${name} is not a directory: ${value}`);
      continue;
    }
    accessSync(value, constants.R_OK | constants.W_OK);
  } catch (error) {
    failures.push(`${name} is not readable and writable: ${value} (${String(error)})`);
  }
}

if (failures.length > 0) {
  console.error(`Runtime configuration is invalid:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Runtime configuration is valid for ${requiredRoots.length} roots.`);
