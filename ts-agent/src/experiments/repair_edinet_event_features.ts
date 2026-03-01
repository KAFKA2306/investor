import { Database } from "bun:sqlite";
import {
  AlphaKnowledgebase,
  type EventFeatureInput,
} from "../context/alpha_knowledgebase.ts";
import { getStringArg, parseCliArgs } from "../providers/cli_args.ts";
import {
  type EdinetIoRepairReport,
  EdinetIoRepairReportSchema,
  type EdinetIoViolation,
} from "../schemas/edinet_io_contract_schema.ts";
import { edinetIds, edinetPaths } from "../utils/edinet_utils.ts";
import { fsUtils } from "../utils/fs_utils.ts";
import { parseIntelligenceMap, toSymbol4 } from "../utils/value_utils.ts";
import {
  EDINET_IO_CONTRACT_VERSION,
  EDINET_IO_EXIT_CODE,
} from "./edinet_io_contract_config.ts";

type CliArgs = {
  knowledgebasePath: string;
  intelligenceMapPath: string;
  reportPath: string;
  quarantinePath: string;
  dryRun: boolean;
  fromDate?: string;
  toDate?: string;
  symbols: Set<string>;
};

type MissingSignalRow = {
  signalId: string;
  symbol: string;
  date: string;
  riskDelta: number;
};

const FEATURE_VERSION = "edinet_event_features_v1.0.0";

const parseArgs = (): CliArgs => {
  const parsedArgs = parseCliArgs(process.argv.slice(2));
  const fromRaw = getStringArg(parsedArgs, "--from-date");
  const toRaw = getStringArg(parsedArgs, "--to-date");
  const fromDate = fromRaw
    ? fsUtils.requirePrerequisites({ from: fromRaw }).from
    : undefined; // Dummy usage to keep requireIsoDate logic if I wanted, but I'll stick to simple check

  const from = fromRaw
    ? /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)
      ? fromRaw
      : undefined
    : undefined;
  const to = toRaw
    ? /^\d{4}-\d{2}-\d{2}$/.test(toRaw)
      ? toRaw
      : undefined
    : undefined;

  const symbolsArg = getStringArg(parsedArgs, "--symbols");
  const symbols = new Set(
    (symbolsArg ?? "")
      .split(",")
      .map((raw) => toSymbol4(raw))
      .filter((s) => /^\d{4}$/.test(s)),
  );

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
    reportPath: getStringArg(
      parsedArgs,
      "--report-path",
      edinetPaths.repairReport,
    )!,
    quarantinePath: getStringArg(
      parsedArgs,
      "--quarantine-path",
      edinetPaths.quarantine,
    )!,
    dryRun: parsedArgs.flags.has("dry-run"),
    fromDate: from,
    toDate: to,
    symbols,
  };
};

const toDocId = edinetIds.toDocId;
const toEventId = edinetIds.toEventId;

const inScope = (row: MissingSignalRow, args: CliArgs): boolean => {
  if (args.symbols.size > 0 && !args.symbols.has(row.symbol)) return false;
  if (args.fromDate && row.date < args.fromDate) return false;
  if (args.toDate && row.date > args.toDate) return false;
  return true;
};

const queryMissingSignals = (db: Database): MissingSignalRow[] =>
  db
    .query(`
      SELECT
        s.signal_id as signalId,
        s.symbol as symbol,
        s.date as date,
        s.risk_delta as riskDelta
      FROM signals s
      LEFT JOIN edinet_event_features ef
        ON ef.symbol = s.symbol AND ef.filed_at = s.date
      WHERE ef.event_id IS NULL
      ORDER BY s.date ASC, s.symbol ASC
    `)
    .all() as MissingSignalRow[];

const countMissingSignals = (db: Database): number => {
  const row = db
    .query(`
      SELECT COUNT(*) as count
      FROM signals s
      LEFT JOIN edinet_event_features ef
        ON ef.symbol = s.symbol AND ef.filed_at = s.date
      WHERE ef.event_id IS NULL
    `)
    .get() as { count: number } | null;
  return Number(row?.count ?? 0);
};

function main(): void {
  const args = parseArgs();
  const runAt = new Date().toISOString();

  const baseReport = {
    runAt,
    contractVersion: EDINET_IO_CONTRACT_VERSION,
    inputs: {
      knowledgebasePath: args.knowledgebasePath,
      intelligenceMapPath: args.intelligenceMapPath,
      quarantinePath: args.quarantinePath,
      dryRun: args.dryRun,
      fromDate: args.fromDate,
      toDate: args.toDate,
      symbols: [...args.symbols].sort(),
    },
    totals: {
      scannedMissingSignals: 0,
      repairedCount: 0,
      unresolvedCount: 0,
      missingBefore: 0,
      missingAfter: 0,
    },
    unresolved: [],
  } satisfies Omit<EdinetIoRepairReport, "status">;

  const failureReason = fsUtils.requirePrerequisites({
    knowledgebasePath: args.knowledgebasePath,
    intelligenceMapPath: args.intelligenceMapPath,
  });
  if (failureReason) {
    fsUtils.writeReport(
      args.reportPath,
      {
        ...baseReport,
        status: "missing_prerequisite",
        failureReason,
      },
      EdinetIoRepairReportSchema,
    );
    console.error(`❌ EDINET repair prerequisite missing: ${failureReason}`);
    process.exit(EDINET_IO_EXIT_CODE.MISSING_PREREQUISITE);
  }

  const map = parseIntelligenceMap(args.intelligenceMapPath);
  const dbRead = new Database(args.knowledgebasePath, { readonly: true });
  const allMissingRows = queryMissingSignals(dbRead);
  const missingBefore = countMissingSignals(dbRead);
  dbRead.close();

  const scopedMissingRows = allMissingRows.filter((row) => inScope(row, args));
  const unresolved: EdinetIoViolation[] = [];
  const docsToUpsert = new Map<
    string,
    { docId: string; symbol: string; filedAt: string; title: string }
  >();
  const eventRows: EventFeatureInput[] = [];

  for (const row of scopedMissingRows) {
    const point = map[row.symbol]?.[row.date];
    if (!point) {
      unresolved.push({
        category: "REFERENTIAL",
        code: "MISSING_INTELLIGENCE_ENTRY",
        message: "No matching entry in edinet_10k_intelligence_map",
        signalId: row.signalId,
        symbol: row.symbol,
        date: row.date,
      });
      continue;
    }
    const docId = toDocId(row.symbol, row.date);
    docsToUpsert.set(docId, {
      docId,
      symbol: row.symbol,
      filedAt: row.date,
      title: `EDINET filing risk snapshot ${row.symbol} ${row.date}`,
    });
    eventRows.push({
      eventId: toEventId(row.symbol, row.date),
      symbol: row.symbol,
      filedAt: row.date,
      docId,
      riskDelta: Number(row.riskDelta ?? 0),
      sentiment: point.sentiment,
      aiExposure: point.aiExposure,
      kgCentrality: point.kgCentrality,
      correctionFlag: point.correctionFlag > 0,
      correctionCount90d: point.correctionCount90d,
      featureVersion: FEATURE_VERSION,
    });
  }

  if (!args.dryRun) {
    const kb = new AlphaKnowledgebase(args.knowledgebasePath);
    for (const doc of docsToUpsert.values()) {
      kb.upsertDocument({
        docId: doc.docId,
        symbol: doc.symbol,
        source: "EDINET",
        filedAt: doc.filedAt,
        title: doc.title,
      });
    }
    kb.upsertEventFeatures(eventRows);
    kb.close();
  }

  const dbAfter = new Database(args.knowledgebasePath, { readonly: true });
  const missingAfter = countMissingSignals(dbAfter);
  dbAfter.close();

  fsUtils.writeJsonl(args.quarantinePath, unresolved);
  const unresolvedCount = unresolved.length;
  const repairedCount = eventRows.length;
  const failByUnresolved = unresolvedCount > 0;
  const failByRemaining = args.dryRun
    ? scopedMissingRows.length > 0
    : missingAfter > 0;
  const hasFailure = failByUnresolved || failByRemaining;

  const report: EdinetIoRepairReport = {
    ...baseReport,
    status: hasFailure ? "fail" : "pass",
    totals: {
      scannedMissingSignals: scopedMissingRows.length,
      repairedCount: Math.max(0, repairedCount),
      unresolvedCount,
      missingBefore,
      missingAfter,
    },
    unresolved,
    failureReason: hasFailure
      ? failByUnresolved
        ? "Unresolved signals exist due to missing intelligence map entries"
        : args.dryRun
          ? "Dry-run detected missing signals that still require repair"
          : "Missing signals remained after repair run"
      : undefined,
  };
  fsUtils.writeReport(args.reportPath, report, EdinetIoRepairReportSchema);

  if (hasFailure) {
    console.error(
      `❌ EDINET repair failed: unresolved=${unresolvedCount}, missingAfter=${missingAfter}, report=${args.reportPath}`,
    );
    process.exit(EDINET_IO_EXIT_CODE.VIOLATION);
  }
  console.log(
    `✅ EDINET repair completed: repaired=${repairedCount}, missingAfter=${missingAfter}, report=${args.reportPath}`,
  );
}

if (import.meta.main) {
  main();
}
