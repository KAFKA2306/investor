import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { z } from "zod";

export function ensureParentDir(targetPath: string): void {
  mkdirSync(dirname(targetPath), { recursive: true });
}

export function writeJsonl<T>(targetPath: string, records: readonly T[]): void {
  ensureParentDir(targetPath);
  if (records.length === 0) {
    writeFileSync(targetPath, "");
    return;
  }
  writeFileSync(
    targetPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
}

export function writeValidatedJson<T>(
  targetPath: string,
  data: T,
  schema?: z.Schema<T>,
): void {
  ensureParentDir(targetPath);
  const validated = schema ? schema.parse(data) : data;
  writeFileSync(targetPath, `${JSON.stringify(validated, null, 2)}\n`);
}

export function readJsonl<T>(sourcePath: string): T[] {
  if (!existsSync(sourcePath)) return [];
  return readFileSync(sourcePath, "utf8")
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .map((line: string) => JSON.parse(line) as T);
}

/**
 * JSONファイルを型安全に読み込むよっ！📖✨
 */
export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

/**
 * Zod スキーマで検証しながら JSON ファイルを読み込むよっ！🛡️✨
 */
export function readValidatedJson<T>(filePath: string, schema: z.Schema<T>): T {
  const raw = readJsonFile<unknown>(filePath);
  return schema.parse(raw);
}

/**
 * CSVファイルを読み込んでオブジェクトの配列にするよっ！📊✨
 */
export function readCsv<T extends Record<string, string>>(
  filePath: string,
  delimiter = ",",
): T[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .filter((l: string) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0]!.split(delimiter).map((h: string) => h.trim());
  return lines.slice(1).map((line: string) => {
    const values = line.split(delimiter).map((v: string) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = values[i] ?? "";
    });
    return obj as T;
  });
}

/**
 * ファイルやディレクトリの存在チェックと、前提条件の確認を一挙に引き受けるよっ！🛡️✨
 */
export function requirePrerequisites(
  paths: Record<string, string>,
): string | null {
  for (const [name, path] of Object.entries(paths)) {
    if (!existsSync(path)) {
      return `${name} missing: ${path}`;
    }
  }
  return null;
}

/**
 * バリデーション済みのレポートを、指定のパスにかわいく保存するよっ！📊✨
 */
export function writeReport<T>(
  targetPath: string,
  report: T,
  schema?: z.Schema<T>,
): void {
  writeValidatedJson(targetPath, report, schema);
}

/**
 * タイムスタンプ付きのファイル名を作るよっ！📅
 */
export function generateTimestampedName(base: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}_${ts}.${ext}`;
}

/**
 * ファイル操作の可愛い相棒、fsUtilsだよっ！📁💖
 */
export const fsUtils = {
  ensureParentDir,
  writeJsonl,
  readJsonl,
  writeValidatedJson,
  readJsonFile,
  readValidatedJson,
  readCsv,
  requirePrerequisites,
  writeReport,
  generateTimestampedName,
};
