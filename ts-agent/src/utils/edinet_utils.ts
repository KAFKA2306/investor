import { join } from "node:path";
import { paths } from "./path_registry.ts";

/**
 * 書類IDを生成するよっ！📄✨
 */
export function toDocId(symbol: string, date: string): string {
  return `EDINET-${symbol}-${date}`;
}

/**
 * イベントIDを生成するよっ！🔔✨
 */
export function toEventId(symbol: string, date: string): string {
  return `EVENT-${symbol}-${date}`;
}

export const edinetIds = { toDocId, toEventId };

/**
 * EDINET関連のパス定数だよっ！📍✨
 */
export const edinetPaths = {
  knowledgebase: paths.uqtlSqlite,
  intelligenceMap: join(paths.dataRoot, "edinet_10k_intelligence_map.json"),
  report: join(paths.verificationRoot, "edinet_io_verify_report.json"),
  repairReport: join(paths.verificationRoot, "edinet_io_repair_report.json"),
  quarantine: join(paths.verificationRoot, "edinet_io_quarantine.json"),
};

/**
 * EDINETの便利ツール、edinetUtilsだよっ！🎀✨
 */
export const edinetUtils = {
  ids: edinetIds,
  paths: edinetPaths,
};
