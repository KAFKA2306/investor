import { join } from "node:path";
import type { EdinetIoViolationCode } from "../schemas/edinet_io_contract_schema.ts";
import { paths } from "../system/path_registry.ts";

export const EDINET_IO_CONTRACT_VERSION = "v1.0.0";

export const EDINET_IO_EXIT_CODE = {
  OK: 0,
  VIOLATION: 2,
  MISSING_PREREQUISITE: 3,
} as const;

export const EDINET_IO_CONTRACT_PATHS = {
  knowledgebasePath: join(
    paths.logsRoot,
    "cache",
    "alpha_knowledgebase.sqlite",
  ),
  intelligenceMapPath: join(
    paths.verificationRoot,
    "edinet_10k_intelligence_map.json",
  ),
  reportPath: join(paths.logsRoot, "verification", "edinet_io_report.json"),
  repairReportPath: join(
    paths.logsRoot,
    "verification",
    "edinet_io_repair_report.json",
  ),
  quarantinePath: join(
    paths.logsRoot,
    "verification",
    "edinet_io_quarantine.ndjson",
  ),
} as const;

export const EDINET_IO_THRESHOLD_BY_CODE: Record<
  EdinetIoViolationCode,
  number
> = {
  NEGATIVE_CORRECTION_COUNT: 0,
  MISSING_INTELLIGENCE_ENTRY: 0,
  CORRECTION_COUNT_MISMATCH: 0,
  CORRECTION_FLAG_MISMATCH: 0,
  SIGNAL_WITHOUT_EVENT: 0,
  EVENT_WITHOUT_SIGNAL: 0,
  LINEAGE_WITHOUT_DOCUMENT: 0,
  SIGNAL_WITHOUT_LINEAGE: 0,
  SIGNAL_WITHOUT_FUTURE_MARKET: 0,
};
