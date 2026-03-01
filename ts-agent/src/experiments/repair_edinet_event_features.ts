import { Database } from "bun:sqlite";
import {
  AlphaKnowledgebase,
  type EventFeatureInput,
} from "../context/alpha_knowledgebase.ts";
import {
  getStringArg,
  hasFlag,
  requireIsoDate,
} from "../providers/cli_args.ts";
import {
  parseIntelligenceMap,
  toSymbol4,
} from "../providers/value_normalizers.ts";
import {
  type EdinetIoRepairReport,
  EdinetIoRepairReportSchema,
  type EdinetIoViolation,
} from "../schemas/edinet_io_contract_schema.ts";
import {
  EDINET_IO_CONTRACT_PATHS,
  EDINET_IO_CONTRACT_VERSION,
  EDINET_IO_EXIT_CODE,
} from "./edinet_io_contract_config.ts";
import {
  buildEdinetIoCliArgs,
  requirePrerequisites,
  writeQuarantine,
  writeReport,
} from "./edinet_io_helpers.ts";

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
  const base = buildEdinetIoCliArgs({
    knowledgebasePath: EDINET_IO_CONTRACT_PATHS.knowledgebasePath,
    intelligenceMapPath: EDINET_IO_CONTRACT_PATHS.intelligenceMapPath,
    reportPath: EDINET_IO_CONTRACT_PATHS.repairReportPath,
    quarantinePath: EDINET_IO_CONTRACT_PATHS.quarantinePath,
  });
  const parsed = base.parsedArgs;
  const fromDateRaw = getStringArg(parsed, "--from-date");
  const toDateRaw = getStringArg(parsed, "--to-date");
  const fromDate = fromDateRaw
    ? requireIsoDate(fromDateRaw, "--from-date")
    : undefined;
  const toDate = toDateRaw ? requireIsoDate(toDateRaw, "--to-date") : undefined;
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error(
      `--from-date must be <= --to-date (${fromDate} > ${toDate})`,
    );
  }
  const symbolsArg = getStringArg(parsed, "--symbols");
  const symbols = new Set(
    (symbolsArg ?? "")
      .split(",")
      .map((raw) => toSymbol4(raw))
      .filter((s) => /^\d{4}$/.test(s)),
  );
  const args: CliArgs = {
    knowledgebasePath: base.knowledgebasePath,
    intelligenceMapPath: base.intelligenceMapPath,
    reportPath: base.reportPath,
    quarantinePath: base.quarantinePath,
    dryRun: hasFlag(parsed, "--dry-run"),
    symbols,
  };
  if (fromDate) args.fromDate = fromDate;
  if (toDate) args.toDate = toDate;
  return args;
};

const toDocId = (symbol: string, date: string): string =>
  `EDINET-${symbol}-${date.replaceAll("-", "")}`;

const toEventId = (symbol: string, date: string): string =>
  `EVT-${symbol}-${date.replaceAll("-", "")}`;

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

  const failureReason = requirePrerequisites({
    knowledgebasePath: args.knowledgebasePath,
    intelligenceMapPath: args.intelligenceMapPath,
  });
  if (failureReason) {
    writeReport(
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

  writeQuarantine(args.quarantinePath, unresolved);
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
  writeReport(args.reportPath, report, EdinetIoRepairReportSchema);

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
