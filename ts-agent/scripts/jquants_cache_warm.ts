import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SqliteHttpCache } from "../src/providers/cache_providers.ts";
import { core } from "../src/system/app_runtime_core.ts";
import {
  getNumberArg,
  getStringArg,
  hasFlag,
  parseCliArgs,
} from "../src/providers/cli_args.ts";
import { toSymbol4 } from "../src/providers/value_normalizers.ts";

type CliArgs = {
  mode: "date" | "symbol";
  from?: string | undefined;
  to?: string | undefined;
  years: number;
  symbols: string[];
  symbolsFile?: string | undefined;
  allListed: boolean;
  maxSymbols?: number | undefined;
  maxUnits?: number | undefined;
  dateOrder: "asc" | "desc";
  ttlHours: number;
  sleepMs: number;
  reqPer30Sec?: number | undefined;
  maxRateLimitErrors: number;
};

type FetchResult = {
  payload: Record<string, unknown>;
  cached: boolean;
};

const toIsoDate = (value: string): string | null => {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  return null;
};

const toJstDateString = (date: Date): string =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const getDefaultToDate = (): string => toJstDateString(new Date());

const getDefaultFromDate = (years: number): string => {
  const now = new Date();
  now.setFullYear(now.getFullYear() - years);
  return toJstDateString(now);
};

const normalizeSymbol = (raw: string): string | null => {
  const s = toSymbol4(raw);
  return /^\d{4}$/.test(s) ? s : null;
};

const toApiCode = (symbol4: string): string =>
  /^\d{4}$/.test(symbol4) ? `${symbol4}0` : symbol4;

const uniqueSymbols = (symbols: readonly string[]): string[] => [
  ...new Set(
    symbols
      .map(normalizeSymbol)
      .filter((s): s is string => s !== null),
  ),
];

const parseArgs = (): CliArgs => {
  const parsed = parseCliArgs(process.argv.slice(2));
  const modeRaw = getStringArg(parsed, "--mode", "date")?.toLowerCase();
  const mode: "date" | "symbol" = modeRaw === "symbol" ? "symbol" : "date";
  const years = Math.max(1, getNumberArg(parsed, "--years", 5));
  const rawSymbols = getStringArg(parsed, "--symbols");
  const symbols = rawSymbols
    ? uniqueSymbols(rawSymbols.split(",").map((s) => s.trim()))
    : [];
  const from = getStringArg(parsed, "--from");
  const to = getStringArg(parsed, "--to");
  const symbolsFile = getStringArg(parsed, "--symbols-file");
  const maxSymbols = getNumberArg(parsed, "--max-symbols", 0);
  const maxUnits = getNumberArg(parsed, "--max-units", 0);
  const dateOrderRaw = getStringArg(parsed, "--date-order", "desc")?.toLowerCase();
  const dateOrder: "asc" | "desc" = dateOrderRaw === "asc" ? "asc" : "desc";
  const ttlHours = Math.max(1, getNumberArg(parsed, "--ttl-hours", 24 * 365));
  const reqPer30Sec = getNumberArg(parsed, "--req-per-30sec", 0);
  const sleepMsFromRate =
    reqPer30Sec > 0
      ? Math.ceil(30000 / reqPer30Sec)
      : undefined;
  const sleepMs = Math.max(
    0,
    getNumberArg(parsed, "--sleep-ms", sleepMsFromRate ?? 1200),
  );
  const maxRateLimitErrors = Math.max(
    1,
    getNumberArg(parsed, "--max-rate-limit-errors", 5),
  );
  const res: CliArgs = {
    mode,
    years,
    symbols,
    allListed: hasFlag(parsed, "--all-listed"),
    dateOrder,
    ttlHours,
    sleepMs,
    reqPer30Sec: reqPer30Sec > 0 ? reqPer30Sec : undefined,
    maxRateLimitErrors,
  };
  if (from) res.from = from;
  if (to) res.to = to;
  if (symbolsFile) res.symbolsFile = symbolsFile;
  if (maxSymbols > 0) res.maxSymbols = maxSymbols;
  if (maxUnits > 0) res.maxUnits = maxUnits;
  return res;
};

const loadSymbolsFromFile = (filePath: string): string[] => {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) return [];
  const raw = readFileSync(resolved, "utf8").trim();
  if (!raw) return [];
  if (resolved.endsWith(".json")) {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return uniqueSymbols(parsed.map((v) => String(v)));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return uniqueSymbols(Object.keys(parsed));
    }
    return [];
  }
  return uniqueSymbols(raw.split(/[\s,\n\r\t]+/));
};

const loadSymbolsFromIntelligenceMap = (): string[] => {
  const filePath = join(
    core.config.paths.verification,
    "edinet_10k_intelligence_map.json",
  );
  if (!existsSync(filePath)) return [];
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return uniqueSymbols(Object.keys(parsed as Record<string, unknown>));
};

const stableKey = (url: string, headers: Record<string, string>): string =>
  JSON.stringify({
    url,
    headers: Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)),
  });

const isUsablePayload = (payload: Record<string, unknown>): boolean => {
  if (Object.keys(payload).length === 0) return false;
  const message = payload.message;
  return typeof message !== "string";
};

const readCachedAny = (
  cache: SqliteHttpCache,
  key: string,
): Record<string, unknown> | undefined => {
  const row = cache.db
    .query("SELECT value FROM http_cache WHERE key = ?1")
    .get(key) as { value: string } | null;
  if (!row) return undefined;
  const parsed = JSON.parse(row.value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const payload = parsed as Record<string, unknown>;
  return isUsablePayload(payload) ? payload : undefined;
};

const writeCache = (
  cache: SqliteHttpCache,
  key: string,
  payload: Record<string, unknown>,
  ttlMs: number,
): void => {
  const now = Date.now();
  cache.db
    .query(
      `INSERT INTO http_cache (key, value, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`,
    )
    .run(key, JSON.stringify(payload), now, now + ttlMs);
};

const fetchJsonCacheFirst = async (
  cache: SqliteHttpCache,
  url: string,
  headers: Record<string, string>,
  ttlMs: number,
): Promise<FetchResult> => {
  const key = stableKey(url, headers);
  const cachedPayload = readCachedAny(cache, key);
  if (cachedPayload) {
    return { payload: cachedPayload, cached: true };
  }

  const response = await fetch(url, { headers });
  const raw = (await response.json()) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `J-Quants payload is not an object: status=${response.status} ${url}`,
    );
  }
  const payload = raw as Record<string, unknown>;
  if (isUsablePayload(payload)) {
    writeCache(cache, key, payload, ttlMs);
  }
  return { payload, cached: false };
};

const extractRows = (payload: Record<string, unknown>): unknown[] => {
  const data = payload.data;
  if (Array.isArray(data)) return data;
  const firstArray = Object.values(payload).find((v) => Array.isArray(v));
  return Array.isArray(firstArray) ? firstArray : [];
};

const extractPaginationKey = (
  payload: Record<string, unknown>,
): string | undefined => {
  const v = payload.pagination_key;
  return typeof v === "string" && v.length > 0 ? v : undefined;
};

const extractCoverageWindow = (
  payload: Record<string, unknown>,
): { from: string; to: string } | null => {
  const message = payload.message;
  if (typeof message !== "string") return null;
  const matched = message.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  if (!matched) return null;
  const from = matched[1];
  const to = matched[2];
  if (!from || !to) return null;
  return { from, to };
};

const toDateKey = (isoDate: string): string => isoDate.replaceAll("-", "");

const enumerateWeekdays = (from: string, to: string): string[] => {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loadSymbolsFromMaster = async (
  cache: SqliteHttpCache,
  headers: Record<string, string>,
  ttlMs: number,
  sleepMs: number,
): Promise<string[]> => {
  let paginationKey: string | undefined;
  const out = new Set<string>();
  do {
    const url = new URL("https://api.jquants.com/v2/equities/master");
    if (paginationKey) {
      url.searchParams.set("pagination_key", paginationKey);
    }
    const { payload, cached } = await fetchJsonCacheFirst(
      cache,
      url.toString(),
      headers,
      ttlMs,
    );
    const rows = extractRows(payload);
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      const code =
        typeof record.Code === "string"
          ? record.Code
          : typeof record.LocalCode === "string"
            ? record.LocalCode
            : "";
      const normalized = normalizeSymbol(code);
      if (normalized) out.add(normalized);
    }
    paginationKey = extractPaginationKey(payload);
    if (!cached && sleepMs > 0 && paginationKey) {
      await sleep(sleepMs);
    }
  } while (paginationKey);
  return [...out].sort();
};

async function run(): Promise<void> {
  const args = parseArgs();
  const from = toIsoDate(args.from ?? "") ?? getDefaultFromDate(args.years);
  const to = toIsoDate(args.to ?? "") ?? getDefaultToDate();
  if (from > to) {
    throw new Error(`Invalid period: from=${from} must be <= to=${to}`);
  }

  const apiKey = core.getEnv("JQUANTS_API_KEY");
  const headers = { "x-api-key": apiKey };
  const cache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "jquants_pead_cache.sqlite"),
  );
  const ttlMs = args.ttlHours * 60 * 60 * 1000;

  let symbols: string[] = [];
  if (args.mode === "symbol") {
    const fromMap = loadSymbolsFromIntelligenceMap();
    const fromFile = args.symbolsFile ? loadSymbolsFromFile(args.symbolsFile) : [];
    const fromListed = args.allListed
      ? await loadSymbolsFromMaster(cache, headers, ttlMs, args.sleepMs)
      : [];
    symbols = uniqueSymbols([
      ...args.symbols,
      ...fromFile,
      ...fromMap,
      ...fromListed,
    ]);
    if (args.maxSymbols) {
      symbols = symbols.slice(0, args.maxSymbols);
    }
    if (symbols.length === 0) {
      throw new Error(
        "No symbols selected. Use --symbols, --symbols-file, --all-listed, or provide edinet_10k_intelligence_map.json",
      );
    }
  }

  let effectiveFrom = from;
  let effectiveTo = to;
  {
    const probeUrl = new URL("https://api.jquants.com/v2/equities/bars/daily");
    probeUrl.searchParams.set("code", "13320");
    probeUrl.searchParams.set("from", from.replaceAll("-", ""));
    probeUrl.searchParams.set("to", to.replaceAll("-", ""));
    const probe = await fetchJsonCacheFirst(
      cache,
      probeUrl.toString(),
      headers,
      ttlMs,
    );
    const coverage = extractCoverageWindow(probe.payload);
    if (coverage) {
      if (from < coverage.from) effectiveFrom = coverage.from;
      if (to > coverage.to) effectiveTo = coverage.to;
      console.log(
        `ℹ️ Subscription window detected | requested=${from}..${to} | effective=${effectiveFrom}..${effectiveTo}`,
      );
    }
  }
  if (effectiveFrom > effectiveTo) {
    throw new Error(
      `No overlap with subscription window: requested=${from}..${to}, effective=${effectiveFrom}..${effectiveTo}`,
    );
  }

  const weekdaysBase = args.mode === "date"
    ? enumerateWeekdays(effectiveFrom, effectiveTo)
    : [];
  const orderedWeekdays =
    args.dateOrder === "desc" ? [...weekdaysBase].reverse() : weekdaysBase;
  const weekdays =
    args.maxUnits !== undefined
      ? orderedWeekdays.slice(0, args.maxUnits)
      : orderedWeekdays;

  console.log(
    args.mode === "date"
      ? `🚀 J-Quants warmup start | mode=date | weekdays=${weekdays.length} | from=${effectiveFrom} | to=${effectiveTo} | cachePolicy=cache-first(always-if-exists)`
      : `🚀 J-Quants warmup start | mode=symbol | symbols=${symbols.length} | from=${effectiveFrom} | to=${effectiveTo} | cachePolicy=cache-first(always-if-exists)`,
  );

  let totalRequests = 0;
  let cacheHits = 0;
  let networkFetches = 0;
  let totalRows = 0;
  let rateLimitErrors = 0;
  let consecutiveRateLimitErrors = 0;
  let abortedByRateLimit = false;
  const startedAt = Date.now();

  if (args.mode === "date") {
    for (const [idx, isoDate] of weekdays.entries()) {
      if (abortedByRateLimit) break;
      let paginationKey: string | undefined;
      let dayRows = 0;
      let dayRequests = 0;
      let dayMisses = 0;
      do {
        const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
        url.searchParams.set("date", toDateKey(isoDate));
        if (paginationKey) {
          url.searchParams.set("pagination_key", paginationKey);
        }
        const { payload, cached } = await fetchJsonCacheFirst(
          cache,
          url.toString(),
          headers,
          ttlMs,
        );
        const rows = extractRows(payload);
        paginationKey = extractPaginationKey(payload);
        const message =
          typeof payload.message === "string" ? payload.message : undefined;
        const isRateLimit = Boolean(
          message?.toLowerCase().includes("rate limit exceeded"),
        );

        totalRequests += 1;
        dayRequests += 1;
        totalRows += rows.length;
        dayRows += rows.length;
        if (cached) {
          cacheHits += 1;
        } else {
          networkFetches += 1;
          dayMisses += 1;
        }
        if (isRateLimit) {
          rateLimitErrors += 1;
          consecutiveRateLimitErrors += 1;
          abortedByRateLimit = true;
          console.log(`⏸️ Stop due to rate limit at date=${isoDate}.`);
        } else {
          consecutiveRateLimitErrors = 0;
        }

        if (!cached && args.sleepMs > 0) {
          await sleep(args.sleepMs);
        }
        if (abortedByRateLimit || consecutiveRateLimitErrors >= args.maxRateLimitErrors) {
          abortedByRateLimit = true;
          break;
        }
      } while (paginationKey);

      if (idx < 10 || (idx + 1) % 25 === 0 || idx + 1 === weekdays.length) {
        console.log(
          `📅 ${idx + 1}/${weekdays.length} ${isoDate} | rows=${dayRows} | requests=${dayRequests} | network=${dayMisses}`,
        );
      }
    }
  } else {
    for (const [idx, symbol] of symbols.entries()) {
      if (abortedByRateLimit) break;
      let paginationKey: string | undefined;
      let symbolRows = 0;
      let symbolRequests = 0;
      let symbolMisses = 0;
      do {
        const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
        url.searchParams.set("code", toApiCode(symbol));
        url.searchParams.set("from", toDateKey(effectiveFrom));
        url.searchParams.set("to", toDateKey(effectiveTo));
        if (paginationKey) {
          url.searchParams.set("pagination_key", paginationKey);
        }
        const { payload, cached } = await fetchJsonCacheFirst(
          cache,
          url.toString(),
          headers,
          ttlMs,
        );
        const rows = extractRows(payload);
        paginationKey = extractPaginationKey(payload);
        const message =
          typeof payload.message === "string" ? payload.message : undefined;
        const isRateLimit = Boolean(
          message?.toLowerCase().includes("rate limit exceeded"),
        );

        totalRequests += 1;
        symbolRequests += 1;
        totalRows += rows.length;
        symbolRows += rows.length;
        if (cached) {
          cacheHits += 1;
        } else {
          networkFetches += 1;
          symbolMisses += 1;
        }
        if (isRateLimit) {
          rateLimitErrors += 1;
          consecutiveRateLimitErrors += 1;
          abortedByRateLimit = true;
          console.log(`⏸️ Stop due to rate limit at symbol=${symbol}.`);
        } else {
          consecutiveRateLimitErrors = 0;
        }

        if (!cached && args.sleepMs > 0) {
          await sleep(args.sleepMs);
        }
        if (abortedByRateLimit || consecutiveRateLimitErrors >= args.maxRateLimitErrors) {
          abortedByRateLimit = true;
          break;
        }
      } while (paginationKey);

      if (idx < 10 || (idx + 1) % 25 === 0 || idx + 1 === symbols.length) {
        console.log(
          `📦 ${idx + 1}/${symbols.length} ${symbol} | rows=${symbolRows} | requests=${symbolRequests} | network=${symbolMisses}`,
        );
      }
    }
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  const hitRate =
    totalRequests === 0
      ? 0
      : Number(((cacheHits / totalRequests) * 100).toFixed(2));

  console.log("✅ J-Quants warmup done");
  const summary = {
    mode: args.mode,
    dateOrder: args.dateOrder,
    maxUnits: args.maxUnits ?? null,
    from: effectiveFrom,
    to: effectiveTo,
    unitCount: args.mode === "date" ? weekdays.length : symbols.length,
    symbols: symbols.length,
    totalRequests,
    cacheHits,
    networkFetches,
    rateLimitErrors,
    abortedByRateLimit,
    hitRatePct: hitRate,
    totalRows,
    elapsedSec,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log(`JQUANTS_WARM_SUMMARY_JSON=${JSON.stringify(summary)}`);
}

if (import.meta.main) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
