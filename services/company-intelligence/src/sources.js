import { unzipSync, strFromU8 } from "fflate";
import { extractSecondaryFacts, mapEdinetCsvRow, normalizeSecurityCode, parseDelimited, sha256Hex } from "./normalization.js";

const EDINET_BASE = "https://api.edinet-fsa.go.jp/api/v2";
const THE_SHASHI_BASE = "https://the-shashi.com/api";
const THE_SHASHI_RESOURCES = ["manifest", "history", "timeline", "decisions", "executives", "shareholders", "financials", "financials-longterm", "segments", "regions", "workforce"];

async function checkedFetch(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), ...options });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

export async function fetchEdinetDocumentList(date, apiKey) {
  if (!apiKey) throw new Error("EDINET_API_KEY is required");
  const url = new URL(`${EDINET_BASE}/documents.json`);
  url.searchParams.set("date", date);
  url.searchParams.set("type", "2");
  url.searchParams.set("Subscription-Key", apiKey);
  return checkedFetch(url).then((response) => response.json());
}

export async function downloadEdinetCsvZip(docId, apiKey) {
  if (!apiKey) throw new Error("EDINET_API_KEY is required");
  const url = new URL(`${EDINET_BASE}/documents/${encodeURIComponent(docId)}`);
  url.searchParams.set("type", "5");
  url.searchParams.set("Subscription-Key", apiKey);
  const response = await checkedFetch(url);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/zip|octet-stream/i.test(contentType)) {
    throw new Error(`EDINET returned unexpected content-type ${contentType} for ${docId}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function parseEdinetCsvZip(zipBytes) {
  const entries = unzipSync(zipBytes);
  const decoder = new TextDecoder("utf-16le");
  const facts = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!/XBRL_TO_CSV\/.*\.csv$/i.test(path)) continue;
    const text = bytes[0] === 0xff && bytes[1] === 0xfe ? decoder.decode(bytes.subarray(2)) : strFromU8(bytes);
    for (const row of parseDelimited(text, "\t")) facts.push({ ...mapEdinetCsvRow(row), sourcePath: path });
  }
  return facts.filter((fact) => fact.elementId && (fact.valueNumeric !== null || fact.valueText !== null));
}

export async function fetchTheShashiResource(secCode, resource) {
  const code = normalizeSecurityCode(secCode);
  if (!THE_SHASHI_RESOURCES.includes(resource)) throw new Error(`unsupported The社史 resource: ${resource}`);
  const url = `${THE_SHASHI_BASE}/${code}/${resource}.json`;
  const response = await checkedFetch(url);
  const text = await response.text();
  const payload = JSON.parse(text);
  return { url, payload, sha256: await sha256Hex(text), facts: resource.startsWith("financials") ? extractSecondaryFacts(payload) : [] };
}

export async function fetchTheShashiBundle(secCode, resources = THE_SHASHI_RESOURCES) {
  const settled = await Promise.allSettled(resources.map(async (resource) => [resource, await fetchTheShashiResource(secCode, resource)]));
  const data = {};
  const errors = [];
  for (const result of settled) {
    if (result.status === "fulfilled") data[result.value[0]] = result.value[1];
    else errors.push(String(result.reason));
  }
  return { data, errors };
}

export { EDINET_BASE, THE_SHASHI_BASE, THE_SHASHI_RESOURCES };
