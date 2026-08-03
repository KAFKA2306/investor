import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Store } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const store = new Store();

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "public, max-age=60" : "no-store",
    "access-control-allow-origin": "*",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) { json(response, 404, { error: "not_found" }); }
function badRequest(response, message) { json(response, 400, { error: "bad_request", message }); }

function parseList(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

async function route(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "content-type" });
    return response.end();
  }
  if (request.method !== "GET") return json(response, 405, { error: "method_not_allowed" });

  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/v1") return json(response, 200, {
    name: "Investor Company Intelligence API",
    version: "1.0.0",
    policy: "EDINET-first; source provenance and reconciliation included",
    documentation: "/openapi.yaml"
  });
  if (path === "/health" || path === "/v1/health") return json(response, 200, await store.health());
  if (path === "/openapi.yaml") {
    const body = await readFile(join(__dirname, "../openapi.yaml"));
    response.writeHead(200, { "content-type": "application/yaml; charset=utf-8", "access-control-allow-origin": "*" });
    return response.end(body);
  }
  if (path === "/v1/companies" || path === "/api/companies.json") {
    const rows = await store.listCompanies({
      q: url.searchParams.get("q") ?? "",
      industry: url.searchParams.get("industry") ?? "",
      limit: Math.min(Number(url.searchParams.get("limit") ?? 100), 500),
      offset: Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    });
    return json(response, 200, path.startsWith("/api/") ? rows.map((row) => ({ code: row.sec_code, name: row.legal_name_ja, edinetCode: row.edinet_code, resources: `/api/${row.sec_code}/manifest.json` })) : { data: rows, count: rows.length });
  }
  if (path === "/v1/compare") {
    const codes = parseList(url.searchParams.get("codes"));
    if (codes.length < 2 || codes.length > 20) return badRequest(response, "codes requires 2-20 comma-separated security codes");
    const concepts = parseList(url.searchParams.get("concepts"));
    return json(response, 200, { codes, concepts, data: await store.compare(codes, concepts) });
  }
  const provenanceMatch = path.match(/^\/v1\/facts\/(\d+)\/provenance$/);
  if (provenanceMatch) {
    const data = await store.factProvenance(Number(provenanceMatch[1]));
    return data ? json(response, 200, data) : notFound(response);
  }

  const compatibilityMatch = path.match(/^\/api\/(\d{4})\/(manifest|financials|financials-longterm|timeline)\.json$/);
  if (compatibilityMatch) {
    const [, code, resource] = compatibilityMatch;
    if (resource === "manifest") {
      const data = await store.manifest(code);
      return data ? json(response, 200, data) : notFound(response);
    }
    if (resource === "financials") {
      const data = await store.latestFinancials(code);
      return data ? json(response, 200, data) : notFound(response);
    }
    if (resource === "financials-longterm") return json(response, 200, await store.financialHistory(code, "", 2000));
    if (resource === "timeline") return json(response, 200, await store.timeline(code, 2000));
  }

  const companyMatch = path.match(/^\/v1\/companies\/([^/]+)(?:\/(financials|facts|filings|timeline|reconciliation))?$/);
  if (companyMatch) {
    const [, code, resource] = companyMatch;
    if (!resource) {
      const data = await store.resolveCompany(code);
      return data ? json(response, 200, data) : notFound(response);
    }
    if (resource === "financials") {
      const latest = await store.latestFinancials(code);
      const history = url.searchParams.get("history") === "true" ? await store.financialHistory(code, url.searchParams.get("concept") ?? "", Math.min(Number(url.searchParams.get("limit") ?? 500), 5000)) : undefined;
      return latest ? json(response, 200, { latest, history }) : notFound(response);
    }
    if (resource === "facts") return json(response, 200, { data: await store.financialHistory(code, url.searchParams.get("concept") ?? "", Math.min(Number(url.searchParams.get("limit") ?? 500), 5000)) });
    if (resource === "filings") return json(response, 200, { data: await store.filings(code, Math.min(Number(url.searchParams.get("limit") ?? 100), 1000)) });
    if (resource === "timeline") return json(response, 200, { data: await store.timeline(code, Math.min(Number(url.searchParams.get("limit") ?? 500), 5000)) });
    if (resource === "reconciliation") return json(response, 200, { data: await store.reconciliation(code) });
  }
  return notFound(response);
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error(error);
    json(response, 500, { error: "internal_error", message: process.env.NODE_ENV === "production" ? undefined : error.message });
  });
});

server.listen(port, "0.0.0.0", () => console.log(`company-intelligence API listening on :${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    server.close();
    await store.close();
    process.exit(0);
  });
}
