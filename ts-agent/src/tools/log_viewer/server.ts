import { readdir } from "node:fs/promises";
import { join } from "node:path";

type AnyRecord = Record<string, unknown>;

type DailyLogSummary = {
  date: string;
  generatedAt: string;
  reportType: string;
  verdict: string;
  dataReadiness: string;
  alphaReadiness: string;
  expectedEdge: number;
  basketDailyReturn: number;
  topSymbol: string;
  file: string;
};

const projectRoot = process.cwd();
const logsDir = join(projectRoot, "../logs/daily");
const indexFile = Bun.file(
  join(projectRoot, "src/tools/log_viewer/index.html"),
);

const pickNumber = (v: unknown): number =>
  typeof v === "number" ? v : Number.NaN;
const pickString = (v: unknown): string => (typeof v === "string" ? v : "");

const toSummary = (file: string, payload: AnyRecord): DailyLogSummary => {
  const report = (payload["report"] ?? payload) as AnyRecord;
  const workflow = (report["workflow"] ?? {}) as AnyRecord;
  const decision = (report["decision"] ?? {}) as AnyRecord;
  const results = (report["results"] ?? {}) as AnyRecord;

  return {
    date: pickString(report["date"]) || file.replace(".json", ""),
    generatedAt:
      pickString(payload["generatedAt"]) || pickString(report["generatedAt"]),
    reportType: pickString(payload["schema"]) || "UNIFIED_LOG",
    verdict:
      pickString(workflow["verdict"]) ||
      pickString(decision["experimentValue"]),
    dataReadiness: pickString(workflow["dataReadiness"]),
    alphaReadiness: pickString(workflow["alphaReadiness"]),
    expectedEdge: pickNumber(results["expectedEdge"]),
    basketDailyReturn: pickNumber(results["basketDailyReturn"]),
    topSymbol: pickString(decision["topSymbol"]),
    file,
  };
};

const readLogPayload = async (file: string): Promise<AnyRecord> => {
  const raw = await Bun.file(join(logsDir, file)).text();
  return JSON.parse(raw) as AnyRecord;
};

const listLogs = async (): Promise<DailyLogSummary[]> => {
  const files = (await readdir(logsDir))
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort()
    .reverse();
  const settled = await Promise.allSettled(
    files.map(async (file) => toSummary(file, await readLogPayload(file))),
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<DailyLogSummary> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
};

const notFound = () =>
  new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

const server = Bun.serve({
  port: Number(process.env["LOG_VIEWER_PORT"] ?? 8787),
  fetch: async (req) => {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const detailMatch = pathname.match(/^\/api\/logs\/(\d{8})$/);

    return pathname === "/api/logs"
      ? new Response(JSON.stringify(await listLogs()), {
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      : detailMatch
        ? (() => {
            const filename = `${detailMatch[1]}.json`;
            const file = Bun.file(join(logsDir, filename));
            return file.exists().then((exists) =>
              exists
                ? new Response(file, {
                    headers: {
                      "content-type": "application/json; charset=utf-8",
                    },
                  })
                : notFound(),
            );
          })()
        : pathname === "/" || pathname === "/index.html"
          ? new Response(indexFile, {
              headers: { "content-type": "text/html; charset=utf-8" },
            })
          : notFound();
  },
});

console.log(`log-viewer listening on http://localhost:${server.port}`);
