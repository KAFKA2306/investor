import { Database } from "bun:sqlite";
import { getStringArg, parseCliArgs } from "../providers/cli_args.ts";
import {
  type EdinetIoReport,
  EdinetIoReportSchema,
  type EdinetIoViolation,
  type EdinetIoViolationCode,
} from "../schemas/edinet_io_contract_schema.ts";
import { dbUtils } from "../utils/db_utils.ts";
import { dateUtils } from "../utils/date_utils.ts";
import { edinetPaths } from "../utils/edinet_utils.ts";
import { fsUtils } from "../utils/fs_utils.ts";
import { parseIntelligenceMap } from "../utils/value_utils.ts";
import {
  EDINET_IO_CONTRACT_VERSION,
  EDINET_IO_EXIT_CODE,
  EDINET_IO_THRESHOLD_BY_CODE,
} from "./edinet_io_contract_config.ts";

type CliArgs = {
  knowledgebasePath: string;
  intelligenceMapPath: string;
  reportPath: string;
  quarantinePath: string;
  quarantineOnly: boolean;
};

type IntelligencePoint = {
  correctionFlag: number;
  correctionCount90d: number;
};

const parseArgs = (): CliArgs => {
  const parsedArgs = parseCliArgs(process.argv.slice(2));
  return {
    knowledgebasePath: getStringArg(
      parsedArgs,
      "--db-path",
      edinetPaths.knowledgebase,
    )!,
    intelligenceMapPath: getStringArg(
      parsedArgs,
      "--intelligence-map-path",
      edinetPaths.intelligenceMap,
    )!,
    reportPath: getStringArg(parsedArgs, "--report-path", edinetPaths.report)!,
    quarantinePath: getStringArg(
      parsedArgs,
      "--quarantine-path",
      edinetPaths.quarantine,
    )!,
    quarantineOnly: parsedArgs.flags.has("quarantine-only"),
  };
};

const makeViolationCountMap = (): Record<EdinetIoViolationCode, number> => ({
  NEGATIVE_CORRECTION_COUNT: 0,
  MISSING_INTELLIGENCE_ENTRY: 0,
  CORRECTION_COUNT_MISMATCH: 0,
  CORRECTION_FLAG_MISMATCH: 0,
  SIGNAL_WITHOUT_EVENT: 0,
  EVENT_WITHOUT_SIGNAL: 0,
  LINEAGE_WITHOUT_DOCUMENT: 0,
  SIGNAL_WITHOUT_LINEAGE: 0,
  SIGNAL_WITHOUT_FUTURE_MARKET: 0,
});

const scopedViolationFilter = (
  violations: readonly EdinetIoViolation[],
  quarantinePath: string,
  quarantineOnly: boolean,
): EdinetIoViolation[] => {
  if (!quarantineOnly) return [...violations];
  const keys = new Set<string>();
  for (const v of fsUtils.readJsonl<Partial<EdinetIoViolation>>(
    quarantinePath,
  )) {
    if (v.signalId) keys.add(`signal:${v.signalId}`);
    if (v.eventId) keys.add(`event:${v.eventId}`);
    if (v.symbol && v.date) keys.add(`symdate:${v.symbol}:${v.date}`);
  }
  return violations.filter((v) => {
    if (v.signalId && keys.has(`signal:${v.signalId}`)) return true;
    if (v.eventId && keys.has(`event:${v.eventId}`)) return true;
    if (v.symbol && v.date && keys.has(`symdate:${v.symbol}:${v.date}`))
      return true;
    return false;
  });
};

function main(): void {
  const args = parseArgs();
  const runAt = dateUtils.nowIso();

  const baseReport = {
    runAt,
    contractVersion: EDINET_IO_CONTRACT_VERSION,
    inputs: {
      knowledgebasePath: args.knowledgebasePath,
      intelligenceMapPath: args.intelligenceMapPath,
      quarantineOnly: args.quarantineOnly,
    },
    totals: {
      signals: 0,
      eventFeatures: 0,
      lineageRows: 0,
      documents: 0,
    },
    thresholdByCode: EDINET_IO_THRESHOLD_BY_CODE,
    violationCountByCode: makeViolationCountMap(),
    violations: [],
  } satisfies Omit<EdinetIoReport, "status">;

  const missingReason = fsUtils.requirePrerequisites({
    knowledgebasePath: args.knowledgebasePath,
    intelligenceMapPath: args.intelligenceMapPath,
  });
  if (missingReason) {
    const report: EdinetIoReport = {
      ...baseReport,
      status: "missing_prerequisite",
      failureReason: missingReason,
    };
    fsUtils.writeReport(args.reportPath, report, EdinetIoReportSchema);
    console.error(
      `❌ EDINET I/O verify prerequisite missing: ${missingReason}`,
    );
    process.exit(EDINET_IO_EXIT_CODE.MISSING_PREREQUISITE);
  }

  const intelligenceMap = parseIntelligenceMap(args.intelligenceMapPath);
  const db = new Database(args.knowledgebasePath, { readonly: true });
  const violations: EdinetIoViolation[] = [];

  const negativeCorrectionRows = db
    .query(`
      SELECT event_id as eventId, symbol, filed_at as date, correction_count_90d as correctionCount90d
      FROM edinet_event_features
      WHERE correction_count_90d < 0
    `)
    .all() as {
    eventId: string;
    symbol: string;
    date: string;
    correctionCount90d: number;
  }[];
  for (const row of negativeCorrectionRows) {
    violations.push({
      category: "SCHEMA",
      code: "NEGATIVE_CORRECTION_COUNT",
      message: "correction_count_90d must be non-negative",
      eventId: row.eventId,
      symbol: row.symbol,
      date: row.date,
      actualValue: row.correctionCount90d,
      expectedValue: 0,
    });
  }

  const eventRows = db
    .query(`
      SELECT event_id as eventId, symbol, filed_at as date, correction_flag as correctionFlag, correction_count_90d as correctionCount90d
      FROM edinet_event_features
    `)
    .all() as {
    eventId: string;
    symbol: string;
    date: string;
    correctionFlag: number;
    correctionCount90d: number;
  }[];
  for (const row of eventRows) {
    const mapPoint = intelligenceMap[row.symbol]?.[row.date];
    if (!mapPoint) {
      violations.push({
        category: "REFERENTIAL",
        code: "MISSING_INTELLIGENCE_ENTRY",
        message: "No matching entry in edinet_10k_intelligence_map",
        eventId: row.eventId,
        symbol: row.symbol,
        date: row.date,
      });
      continue;
    }
    const normalizedFlag = row.correctionFlag > 0 ? 1 : 0;
    const expectedFlag = mapPoint.correctionFlag > 0 ? 1 : 0;
    if (normalizedFlag !== expectedFlag) {
      violations.push({
        category: "CARDINALITY",
        code: "CORRECTION_FLAG_MISMATCH",
        message: "correction_flag does not match intelligence map",
        eventId: row.eventId,
        symbol: row.symbol,
        date: row.date,
        actualValue: normalizedFlag,
        expectedValue: expectedFlag,
      });
    }
    if (Math.floor(row.correctionCount90d) !== mapPoint.correctionCount90d) {
      violations.push({
        category: "CARDINALITY",
        code: "CORRECTION_COUNT_MISMATCH",
        message: "correction_count_90d does not match intelligence map",
        eventId: row.eventId,
        symbol: row.symbol,
        date: row.date,
        actualValue: row.correctionCount90d,
        expectedValue: mapPoint.correctionCount90d,
      });
    }
  }

  const signalWithoutEvent = db
    .query(`
      SELECT s.signal_id as signalId, s.symbol as symbol, s.date as date
      FROM signals s
      LEFT JOIN edinet_event_features ef
        ON ef.symbol = s.symbol AND ef.filed_at = s.date
      WHERE ef.event_id IS NULL
    `)
    .all() as { signalId: string; symbol: string; date: string }[];
  for (const row of signalWithoutEvent) {
    violations.push({
      category: "REFERENTIAL",
      code: "SIGNAL_WITHOUT_EVENT",
      message: "signal has no matching edinet_event_features row",
      signalId: row.signalId,
      symbol: row.symbol,
      date: row.date,
    });
  }

  const eventWithoutSignal = db
    .query(`
      SELECT ef.event_id as eventId, ef.symbol as symbol, ef.filed_at as date
      FROM edinet_event_features ef
      LEFT JOIN signals s
        ON s.symbol = ef.symbol AND s.date = ef.filed_at
      WHERE s.signal_id IS NULL
    `)
    .all() as { eventId: string; symbol: string; date: string }[];
  for (const row of eventWithoutSignal) {
    violations.push({
      category: "REFERENTIAL",
      code: "EVENT_WITHOUT_SIGNAL",
      message: "edinet_event_features row has no matching signal",
      eventId: row.eventId,
      symbol: row.symbol,
      date: row.date,
    });
  }

  const lineageWithoutDocument = db
    .query(`
      SELECT sl.signal_id as signalId, sl.source_doc_id as docId
      FROM signal_lineage sl
      LEFT JOIN documents d ON d.doc_id = sl.source_doc_id
      WHERE d.doc_id IS NULL
    `)
    .all() as { signalId: string; docId: string }[];
  for (const row of lineageWithoutDocument) {
    violations.push({
      category: "REFERENTIAL",
      code: "LINEAGE_WITHOUT_DOCUMENT",
      message: "signal_lineage references missing document",
      signalId: row.signalId,
      docId: row.docId,
    });
  }

  const signalWithoutLineage = db
    .query(`
      SELECT s.signal_id as signalId, s.symbol as symbol, s.date as date
      FROM signals s
      LEFT JOIN signal_lineage sl ON sl.signal_id = s.signal_id
      WHERE sl.signal_id IS NULL
    `)
    .all() as { signalId: string; symbol: string; date: string }[];
  for (const row of signalWithoutLineage) {
    violations.push({
      category: "REFERENTIAL",
      code: "SIGNAL_WITHOUT_LINEAGE",
      message: "signal has no lineage row",
      signalId: row.signalId,
      symbol: row.symbol,
      date: row.date,
    });
  }

  const signalWithoutFutureMarket = db
    .query(`
      SELECT s.signal_id as signalId, s.symbol as symbol, s.date as date
      FROM signals s
      WHERE NOT EXISTS (
        SELECT 1 FROM market_daily m
        WHERE m.symbol = s.symbol AND m.date > s.date
      )
    `)
    .all() as { signalId: string; symbol: string; date: string }[];
  for (const row of signalWithoutFutureMarket) {
    violations.push({
      category: "TEMPORAL",
      code: "SIGNAL_WITHOUT_FUTURE_MARKET",
      message:
        "signal has no future market_daily row for PIT-safe forward return",
      signalId: row.signalId,
      symbol: row.symbol,
      date: row.date,
    });
  }

  const scopedViolations = scopedViolationFilter(
    violations,
    args.quarantinePath,
    args.quarantineOnly,
  );
  const violationCountByCode = makeViolationCountMap();
  for (const v of scopedViolations) {
    violationCountByCode[v.code] += 1;
  }

  const hasBlockingViolation = (
    Object.keys(EDINET_IO_THRESHOLD_BY_CODE) as EdinetIoViolationCode[]
  ).some((code) => {
    const actualCount = violationCountByCode[code] ?? 0;
    const threshold = EDINET_IO_THRESHOLD_BY_CODE[code] ?? 0;
    return actualCount > threshold;
  });

  const report: EdinetIoReport = {
    ...baseReport,
    status: hasBlockingViolation ? "fail" : "pass",
    totals: {
      signals: dbUtils.count(db, "signals"),
      eventFeatures: dbUtils.count(db, "edinet_event_features"),
      lineageRows: dbUtils.count(db, "signal_lineage"),
      documents: dbUtils.count(db, "documents"),
    },
    violationCountByCode,
    violations: scopedViolations,
  };
  db.close();

  fsUtils.writeReport(args.reportPath, report, EdinetIoReportSchema);
  if (hasBlockingViolation) {
    fsUtils.writeJsonl(args.quarantinePath, scopedViolations);
    console.error(
      `❌ EDINET I/O contract failed: violations=${scopedViolations.length}, report=${args.reportPath}`,
    );
    process.exit(EDINET_IO_EXIT_CODE.VIOLATION);
  }
  fsUtils.writeJsonl(args.quarantinePath, []);
  console.log(
    `✅ EDINET I/O contract passed: violations=0, report=${args.reportPath}`,
  );
}

if (import.meta.main) {
  main();
}
