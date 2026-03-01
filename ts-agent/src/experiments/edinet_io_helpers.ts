import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import type { z } from "zod";
import { getStringArg, parseCliArgs } from "../providers/cli_args.ts";
import { writeJsonl, writeValidatedJson } from "../utils/fs_utils.ts";

export type EdinetIoCliDefaults = {
  knowledgebasePath: string;
  intelligenceMapPath: string;
  reportPath: string;
  quarantinePath: string;
};

export type EdinetIoCliBaseArgs = {
  knowledgebasePath: string;
  intelligenceMapPath: string;
  reportPath: string;
  quarantinePath: string;
  parsedArgs: ReturnType<typeof parseCliArgs>;
};

export const buildEdinetIoCliArgs = (
  defaults: EdinetIoCliDefaults,
  rawArgs = process.argv.slice(2),
): EdinetIoCliBaseArgs => {
  const parsedArgs = parseCliArgs(rawArgs);
  return {
    knowledgebasePath: getStringArg(
      parsedArgs,
      "--db-path",
      defaults.knowledgebasePath,
    )!,
    intelligenceMapPath: getStringArg(
      parsedArgs,
      "--intelligence-map-path",
      defaults.intelligenceMapPath,
    )!,
    reportPath: getStringArg(parsedArgs, "--report-path", defaults.reportPath)!,
    quarantinePath: getStringArg(
      parsedArgs,
      "--quarantine-path",
      defaults.quarantinePath,
    )!,
    parsedArgs,
  };
};

export const requirePrerequisites = (paths: {
  knowledgebasePath: string;
  intelligenceMapPath: string;
}): string | null => {
  if (!existsSync(paths.knowledgebasePath)) {
    return `knowledgebase missing: ${paths.knowledgebasePath}`;
  }
  if (!existsSync(paths.intelligenceMapPath)) {
    return `intelligence map missing: ${paths.intelligenceMapPath}`;
  }
  return null;
};

export const writeQuarantine = <T>(
  targetPath: string,
  violations: readonly T[],
): void => {
  writeJsonl(targetPath, violations);
};

export const writeReport = <T>(
  targetPath: string,
  report: T,
  schema?: z.Schema<T>,
): void => {
  writeValidatedJson(targetPath, report, schema);
};

export const countRows = (db: Database, table: string): number => {
  const row = db.query(`SELECT COUNT(*) as count FROM ${table}`).get() as {
    count: number;
  } | null;
  return Number(row?.count ?? 0);
};
