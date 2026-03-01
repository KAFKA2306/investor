import { Database } from "bun:sqlite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type EdinetDocument,
  EdinetDocumentSchema,
  EdinetProvider,
} from "../providers/edinet_provider.ts";
import { EdinetSearchProvider } from "../providers/edinet_search_provider.ts";
import { DataPipelineRuntime } from "../system/data_pipeline_runtime.ts";

type IntelligencePoint = {
  sentiment: number;
  aiExposure: number;
  kgCentrality: number;
};

type IntelligenceMap = Record<string, Record<string, IntelligencePoint>>;

type CliArgs = {
  from: string;
  to: string;
  symbols: string[];
  maxSymbols: number;
  allSymbols: boolean;
  docTypes: Set<string>;
  overwriteExisting: boolean;
  indexedOnly: boolean;
  cacheOnly: boolean;
  listCacheOnly: boolean;
  metadataOnly: boolean;
  sleepMs: number;
  flushEvery: number;
};

type SectionRow = {
  sectionName: string;
  content: string;
};

const DEFAULT_FROM = "2018-01-01";
const DEFAULT_DOC_TYPES = ["030", "043", "120"] as const;

const wait = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const pickArg = (args: readonly string[], key: string): string | undefined => {
  const prefix = `${key}=`;
  const matched = args.find((value) => value.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : undefined;
};

const hasFlag = (args: readonly string[], flag: string): boolean =>
  args.includes(flag);

const toSymbol4 = (value: string): string =>
  value.replace(".T", "").trim().slice(0, 4);

const parseIsoDate = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format: ${value} (expected YYYY-MM-DD)`);
  }
  return value;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const from = parseIsoDate(pickArg(args, "--from") ?? DEFAULT_FROM);
  const to = parseIsoDate(pickArg(args, "--to") ?? today);
  if (from > to) {
    throw new Error(`--from must be <= --to (from=${from}, to=${to})`);
  }
  const maxSymbols = Math.max(
    1,
    Number.parseInt(pickArg(args, "--max-symbols") ?? "3000", 10),
  );
  const allSymbols = hasFlag(args, "--all-symbols");
  const rawSymbols = pickArg(args, "--symbols");
  const symbols = rawSymbols
    ? rawSymbols
        .split(",")
        .map((s) => toSymbol4(s))
        .filter((s) => /^\d{4}$/.test(s))
    : [];
  const docTypesRaw = pickArg(args, "--doc-types");
  const docTypes = new Set(
    (docTypesRaw ? docTypesRaw.split(",") : [...DEFAULT_DOC_TYPES])
      .map((v) => v.trim())
      .filter((v) => /^\d{3}$/.test(v)),
  );
  const overwriteExisting = hasFlag(args, "--overwrite-existing");
  const indexedOnly = hasFlag(args, "--indexed-only");
  const cacheOnly = hasFlag(args, "--cache-only");
  const listCacheOnly = hasFlag(args, "--list-cache-only");
  const metadataOnly = hasFlag(args, "--metadata-only");
  const sleepMs = Math.max(
    0,
    Number.parseInt(pickArg(args, "--sleep-ms") ?? "100", 10),
  );
  const flushEvery = Math.max(
    1,
    Number.parseInt(pickArg(args, "--flush-every") ?? "25", 10),
  );
  return {
    from,
    to,
    symbols,
    maxSymbols,
    allSymbols,
    docTypes,
    overwriteExisting,
    indexedOnly,
    cacheOnly,
    listCacheOnly,
    metadataOnly,
    sleepMs,
    flushEvery,
  };
};

const mapPath = (): string =>
  join(process.cwd(), "data", "edinet_10k_intelligence_map.json");

const loadMap = (): IntelligenceMap => {
  const filePath = mapPath();
  if (!existsSync(filePath)) return {};
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<
    string,
    Record<string, Partial<IntelligencePoint>>
  >;
  const normalized: IntelligenceMap = {};
  for (const [symbolRaw, byDate] of Object.entries(raw)) {
    const symbol = toSymbol4(symbolRaw);
    if (!/^\d{4}$/.test(symbol)) continue;
    for (const [date, point] of Object.entries(byDate ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!normalized[symbol]) normalized[symbol] = {};
      normalized[symbol][date] = {
        sentiment: Number.isFinite(Number(point.sentiment))
          ? Number(point.sentiment)
          : 0.5,
        aiExposure: Number.isFinite(Number(point.aiExposure))
          ? Number(point.aiExposure)
          : 0,
        kgCentrality: Number.isFinite(Number(point.kgCentrality))
          ? Number(point.kgCentrality)
          : 0,
      };
    }
  }
  return normalized;
};

const saveMap = (featureMap: IntelligenceMap): void => {
  const cleaned: IntelligenceMap = {};
  for (const [symbol, byDate] of Object.entries(featureMap)) {
    const entries = Object.entries(byDate).filter(([date]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date),
    );
    if (entries.length === 0) continue;
    cleaned[symbol] = Object.fromEntries(entries);
  }
  writeFileSync(mapPath(), JSON.stringify(cleaned, null, 2));
};

const resolveUniverseSymbols = (
  runtime: DataPipelineRuntime,
  args: CliArgs,
): string[] => {
  if (args.symbols.length > 0) {
    return [...new Set(args.symbols)];
  }
  const max = args.allSymbols ? Number.MAX_SAFE_INTEGER : args.maxSymbols;
  return runtime.resolveUniverse([], max);
};

const getSubmitDate = (doc: EdinetDocument): string | null => {
  const v = doc.submitDateTime?.slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

const buildFeature = (riskSection: string): IntelligencePoint => {
  const pos = (riskSection.match(/成長|拡大|改善|向上|回復|増益/g) ?? [])
    .length;
  const neg = (riskSection.match(/不明|減速|悪化|不調|懸念|減益/g) ?? [])
    .length;
  const sentiment = pos + neg === 0 ? 0.5 : pos / (pos + neg);
  const aiExposure = (
    riskSection.match(/AI|人工知能|機械学習|LLM|Deep Learning/gi) ?? []
  ).length;
  const kgCentrality = (
    riskSection.match(/[A-Z][a-z]+ [A-Z][a-z]+|株式会社/g) ?? []
  ).length;
  return { sentiment, aiExposure, kgCentrality };
};

const metadataText = (doc: EdinetDocument): string =>
  [doc.docDescription ?? "", doc.filerName ?? ""].join(" ").trim();

const coverageStats = (
  featureMap: IntelligenceMap,
): {
  symbols: number;
  events: number;
  minDate: string;
  maxDate: string;
} => {
  let symbols = 0;
  let events = 0;
  let minDate = "9999-99-99";
  let maxDate = "0000-00-00";
  for (const byDate of Object.values(featureMap)) {
    let hasEvent = false;
    for (const date of Object.keys(byDate)) {
      events += 1;
      hasEvent = true;
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }
    if (hasEvent) symbols += 1;
  }
  if (events === 0) {
    minDate = "";
    maxDate = "";
  }
  return { symbols, events, minDate, maxDate };
};

const loadDocumentListsFromCache = (
  from: string,
  to: string,
): Map<string, EdinetDocument[]> => {
  const dbPath = join(process.cwd(), "../logs/cache/edinet_cache.sqlite");
  if (!existsSync(dbPath)) {
    return new Map();
  }
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .query(
      "SELECT key, value FROM http_cache WHERE key LIKE '%documents.json%' AND key LIKE '%type=2%'",
    )
    .all() as Array<{ key: string; value: string }>;
  const byDate = new Map<string, EdinetDocument[]>();
  for (const row of rows) {
    try {
      const keyObj = JSON.parse(row.key) as { url?: string };
      if (!keyObj.url) continue;
      const url = new URL(keyObj.url);
      const date = url.searchParams.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (date < from || date > to) continue;

      const payload = JSON.parse(row.value) as { results?: unknown[] };
      const validDocs: EdinetDocument[] = [];
      for (const item of payload.results ?? []) {
        const parsed = EdinetDocumentSchema.safeParse(item);
        if (parsed.success) validDocs.push(parsed.data);
      }
      byDate.set(date, validDocs);
    } catch {
      // ignore malformed cache rows
    }
  }
  db.close();
  return byDate;
};

async function main(): Promise<void> {
  const args = parseArgs();
  const runtime = new DataPipelineRuntime();
  const symbols4 = resolveUniverseSymbols(runtime, args);
  const universeSet = new Set(symbols4.map((s) => `${s}0`));

  const featureMap = loadMap();
  const before = coverageStats(featureMap);

  const edinet = new EdinetProvider();
  const search = new EdinetSearchProvider();
  const dbPath = join(process.cwd(), "../logs/cache/edinet_search.sqlite");
  const db = new Database(dbPath, { create: true });
  const sectionQuery = db.prepare(
    "SELECT sectionName, content FROM edinet_search WHERE docID = ?",
  );
  const cachedDocLists = args.listCacheOnly
    ? loadDocumentListsFromCache(args.from, args.to)
    : null;

  console.log(
    `🚀 EDINET scan start: ${args.from} -> ${args.to}, symbols=${symbols4.length}, docTypes=${[...args.docTypes].join(",")}, metadataOnly=${String(args.metadataOnly)}, cacheOnly=${String(args.cacheOnly)}, listCacheOnly=${String(args.listCacheOnly)}`,
  );

  const matchedByKey = new Map<string, EdinetDocument>();
  let scannedDays = 0;
  let scannedDocs = 0;
  let matchedDocs = 0;

  for (
    let d = new Date(`${args.from}T00:00:00Z`);
    d <= new Date(`${args.to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);
    scannedDays += 1;
    try {
      const docs = cachedDocLists
        ? (cachedDocLists.get(dateStr) ?? [])
        : (await edinet.getDocumentList(dateStr, 2)).results;
      scannedDocs += docs.length;

      for (const doc of docs) {
        if (!doc.secCode || !universeSet.has(doc.secCode)) continue;
        if (!doc.docTypeCode) continue;
        if (!args.docTypes.has(doc.docTypeCode)) continue;
        const symbol4 = doc.secCode.slice(0, 4);
        if (!/^\d{4}$/.test(symbol4)) continue;
        const submitDate = getSubmitDate(doc);
        if (!submitDate) continue;
        const key = `${symbol4}:${submitDate}`;
        const previous = matchedByKey.get(key);
        if (
          !previous ||
          (previous.submitDateTime ?? "") < (doc.submitDateTime ?? "")
        ) {
          matchedByKey.set(key, doc);
        }
        matchedDocs += 1;
      }
    } catch (e) {
      console.warn(`⚠️ Skip ${dateStr}: ${e}`);
    }
    await wait(args.sleepMs);
  }

  const docsToProcess = [...matchedByKey.values()]
    .filter((doc) => {
      if (args.overwriteExisting) return true;
      const symbol4 = doc.secCode?.slice(0, 4) ?? "";
      const submitDate = getSubmitDate(doc);
      if (!/^\d{4}$/.test(symbol4) || !submitDate) return false;
      return !featureMap[symbol4]?.[submitDate];
    })
    .filter((doc) => {
      if (!args.indexedOnly) return true;
      const existingSegments = sectionQuery.all(doc.docID) as SectionRow[];
      return existingSegments.length > 0;
    })
    .sort((a, b) =>
      (a.submitDateTime ?? "").localeCompare(b.submitDateTime ?? ""),
    );

  console.log(
    `📦 scan done: scannedDays=${scannedDays}, scannedDocs=${scannedDocs}, matchedRaw=${matchedDocs}, uniqueSymbolDate=${matchedByKey.size}, toProcess=${docsToProcess.length}`,
  );

  let inserted = 0;
  let insertedFromMetadata = 0;
  let insertedFromIndexed = 0;
  let failed = 0;

  for (const doc of docsToProcess) {
    const symbol4 = doc.secCode?.slice(0, 4) ?? "";
    const submitDate = getSubmitDate(doc);
    if (!/^\d{4}$/.test(symbol4) || !submitDate) continue;

    try {
      console.log(`🗂️ ${doc.docID} -> ${symbol4}@${submitDate}`);
      const existingSegments = sectionQuery.all(doc.docID) as SectionRow[];
      if (existingSegments.length > 0) {
        const indexedRiskSection =
          existingSegments.find((s) => s.sectionName.includes("事業等のリスク"))
            ?.content ?? existingSegments.map((s) => s.content).join(" ");
        const text = indexedRiskSection.trim();
        if (text.length === 0) {
          failed += 1;
          continue;
        }
        if (!featureMap[symbol4]) featureMap[symbol4] = {};
        featureMap[symbol4][submitDate] = buildFeature(text);
        inserted += 1;
        insertedFromIndexed += 1;
        if (inserted % args.flushEvery === 0) {
          saveMap(featureMap);
          console.log(`💾 flush: inserted=${inserted}`);
        }
        continue;
      }

      if (args.metadataOnly) {
        const fallbackText = metadataText(doc);
        if (fallbackText.length === 0) {
          failed += 1;
          continue;
        }
        if (!featureMap[symbol4]) featureMap[symbol4] = {};
        featureMap[symbol4][submitDate] = buildFeature(fallbackText);
        inserted += 1;
        insertedFromMetadata += 1;
        if (inserted % args.flushEvery === 0) {
          saveMap(featureMap);
          console.log(`💾 flush: inserted=${inserted}`);
        }
        continue;
      }

      const cacheZipPath = join(
        process.cwd(),
        "../logs/cache/edinet_docs",
        `${doc.docID}_type1.zip`,
      );
      const zipPath = existsSync(cacheZipPath)
        ? cacheZipPath
        : args.cacheOnly
          ? null
          : await edinet.downloadDocument(doc.docID, 1);
      if (!zipPath) {
        failed += 1;
        continue;
      }

      await search.indexDocument(
        doc.docID,
        doc.secCode ?? undefined,
        doc.filerName ?? undefined,
        doc.docDescription ?? undefined,
      );

      const segments = sectionQuery.all(doc.docID) as SectionRow[];
      const riskSection =
        segments.find((s) => s.sectionName.includes("事業等のリスク"))
          ?.content ?? segments.map((s) => s.content).join(" ");
      if (!riskSection.trim()) {
        failed += 1;
        continue;
      }
      if (!featureMap[symbol4]) featureMap[symbol4] = {};
      featureMap[symbol4][submitDate] = buildFeature(riskSection);
      inserted += 1;

      if (inserted % args.flushEvery === 0) {
        saveMap(featureMap);
        console.log(`💾 flush: inserted=${inserted}`);
      }
    } catch (e) {
      failed += 1;
      console.error(`❌ ${doc.docID} failed: ${e}`);
    }
  }

  saveMap(featureMap);
  const after = coverageStats(featureMap);
  console.log(
    JSON.stringify(
      {
        from: args.from,
        to: args.to,
        metadataOnly: args.metadataOnly,
        indexedOnly: args.indexedOnly,
        cacheOnly: args.cacheOnly,
        listCacheOnly: args.listCacheOnly,
        symbolsTargeted: symbols4.length,
        docTypes: [...args.docTypes],
        scan: {
          scannedDays,
          scannedDocs,
          matchedRaw: matchedDocs,
          uniqueSymbolDate: matchedByKey.size,
          processed: docsToProcess.length,
          inserted,
          insertedFromMetadata,
          insertedFromIndexed,
          failed,
        },
        coverageBefore: before,
        coverageAfter: after,
        coverageDelta: {
          symbols: after.symbols - before.symbols,
          events: after.events - before.events,
        },
        output: mapPath(),
      },
      null,
      2,
    ),
  );

  db.close();
  search.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
