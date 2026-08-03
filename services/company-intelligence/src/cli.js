import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Store } from "./store.js";
import { downloadEdinetCsvZip, fetchEdinetDocumentList, fetchTheShashiBundle, parseEdinetCsvZip } from "./sources.js";
import { normalizeSecurityCode, sha256Hex } from "./normalization.js";

const args = process.argv.slice(2);
const command = args.shift();
const option = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const listOption = (name, fallback = "") => option(name, fallback).split(",").map((item) => item.trim()).filter(Boolean);

const store = new Store();

async function ingestTheShashi(codes) {
  const run = await store.startRun("THE_SHASHI", { codes });
  let fetched = 0;
  let inserted = 0;
  const errors = [];
  try {
    for (const rawCode of codes) {
      const code = normalizeSecurityCode(rawCode);
      const companyId = await store.companyId(code);
      const bundle = await fetchTheShashiBundle(code);
      errors.push(...bundle.errors.map((message) => ({ code, message })));
      for (const [resource, data] of Object.entries(bundle.data)) {
        fetched += 1;
        const rawDocumentId = await store.saveRawDocument({
          sourceKey: "THE_SHASHI",
          companyId,
          runId: run.ingestion_run_id,
          externalId: `${code}/${resource}`,
          resourceType: resource,
          canonicalUrl: data.url,
          payload: data.payload,
          contentSha256: data.sha256,
          exportAllowed: false,
          metadata: { redistribution: "disabled_by_default" }
        });
        if (data.facts.length > 0) inserted += await store.saveSecondaryFacts({ companyId, sourceKey: "THE_SHASHI", rawDocumentId, facts: data.facts });
      }
    }
    await store.finishRun(run.ingestion_run_id, errors.length ? "partial" : "succeeded", { fetched, inserted }, errors);
  } catch (error) {
    errors.push({ message: error.message });
    await store.finishRun(run.ingestion_run_id, "failed", { fetched, inserted }, errors);
    throw error;
  }
  return { fetched, inserted, errors };
}

async function ingestEdinet(date, codes) {
  const apiKey = process.env.EDINET_API_KEY;
  const run = await store.startRun("EDINET_V2", { date, codes });
  let fetched = 0;
  let inserted = 0;
  const errors = [];
  try {
    const documentList = await fetchEdinetDocumentList(date, apiKey);
    const wanted = new Set(codes.map((code) => `${normalizeSecurityCode(code)}0`));
    const documents = (documentList.results ?? []).filter((doc) => wanted.has(String(doc.secCode ?? "").trim()) && ["120", "130", "160"].includes(String(doc.docTypeCode ?? "")) && doc.csvFlag === "1");
    for (const doc of documents) {
      try {
        const secCode = normalizeSecurityCode(doc.secCode);
        const companyId = await store.companyId(secCode);
        const zip = await downloadEdinetCsvZip(doc.docID, apiKey);
        const sha = await sha256Hex(zip);
        const rawDocumentId = await store.saveRawDocument({
          sourceKey: "EDINET_V2",
          companyId,
          runId: run.ingestion_run_id,
          externalId: doc.docID,
          resourceType: "edinet_csv_zip",
          canonicalUrl: `https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100=${doc.docID}`,
          payload: { document: doc, zip_sha256: sha },
          contentSha256: sha,
          exportAllowed: true
        });
        const sourceId = await store.sourceId("EDINET_V2");
        const filing = await store.query(`
          insert into company_intelligence.filing(company_id,source_id,raw_document_id,doc_id,doc_type_code,ordinance_code,form_code,filing_name,submitted_at,period_start,period_end,xbrl_available,csv_available,pdf_available,metadata)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          on conflict(source_id,doc_id) do update set raw_document_id=excluded.raw_document_id, submitted_at=excluded.submitted_at, metadata=excluded.metadata
          returning filing_id`, [companyId, sourceId, rawDocumentId, doc.docID, doc.docTypeCode, doc.ordinanceCode, doc.formCode, doc.docDescription, doc.submitDateTime || null, doc.periodStart || null, doc.periodEnd || null, doc.xbrlFlag === "1", doc.csvFlag === "1", doc.pdfFlag === "1", doc]);
        const filingId = filing.rows[0].filing_id;
        const facts = parseEdinetCsvZip(zip);
        for (const fact of facts) {
          const concept = fact.conceptKey ? await store.query(`select fact_concept_id from company_intelligence.fact_concept where concept_key=$1`, [fact.conceptKey]) : { rows: [] };
          await store.query(`
            insert into company_intelligence.fact(company_id,source_id,filing_id,raw_document_id,fact_concept_id,element_id,label,context_id,period_start,period_end,instant_date,accounting_standard,consolidated,relative_fiscal_year,unit_id,unit_label,value_numeric,value_text,quality_flag,source_priority,metadata)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'official',1,$19)
            on conflict do nothing`, [companyId, sourceId, filingId, rawDocumentId, concept.rows[0]?.fact_concept_id ?? null, fact.elementId, fact.label, fact.contextId, fact.periodStart, fact.periodEnd, fact.instantDate, null, fact.consolidated, fact.relativeFiscalYear, fact.unitId, fact.unitLabel, fact.valueNumeric, fact.valueText, { ...fact.metadata, source_path: fact.sourcePath }]);
          inserted += 1;
        }
        fetched += 1;
      } catch (error) { errors.push({ docID: doc.docID, message: error.message }); }
    }
    await store.finishRun(run.ingestion_run_id, errors.length ? "partial" : "succeeded", { fetched, inserted }, errors);
  } catch (error) {
    errors.push({ message: error.message });
    await store.finishRun(run.ingestion_run_id, "failed", { fetched, inserted }, errors);
    throw error;
  }
  return { fetched, inserted, errors };
}

async function exportStatic(outputDir) {
  const companies = await store.listCompanies({ limit: 5000 });
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "companies.json"), JSON.stringify(companies.map((company) => ({ code: company.sec_code, name: company.legal_name_ja, edinetCode: company.edinet_code })), null, 2));
  for (const company of companies) {
    const dir = resolve(outputDir, company.sec_code);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, "manifest.json"), JSON.stringify(await store.manifest(company.sec_code), null, 2));
    await writeFile(resolve(dir, "financials.json"), JSON.stringify(await store.latestFinancials(company.sec_code), null, 2));
    await writeFile(resolve(dir, "financials-longterm.json"), JSON.stringify(await store.financialHistory(company.sec_code, "", 5000), null, 2));
    await writeFile(resolve(dir, "timeline.json"), JSON.stringify(await store.timeline(company.sec_code, 5000), null, 2));
  }
  return { companyCount: companies.length, outputDir };
}

try {
  if (command === "ingest") {
    const source = option("source", "all");
    const codes = listOption("codes", "2801,2897");
    const results = {};
    if (["all", "the-shashi"].includes(source)) results.theShashi = await ingestTheShashi(codes);
    if (["all", "edinet"].includes(source)) {
      const date = option("date");
      if (!date) throw new Error("--date YYYY-MM-DD is required for EDINET ingestion");
      results.edinet = await ingestEdinet(date, codes);
    }
    console.log(JSON.stringify(results, null, 2));
  } else if (command === "reconcile") {
    const results = {};
    for (const code of listOption("codes", "2801,2897")) results[code] = await store.reconcileCompany(code);
    console.log(JSON.stringify(results, null, 2));
  } else if (command === "export-static") {
    console.log(JSON.stringify(await exportStatic(resolve(option("output", "../../docs/api/company-intelligence"))), null, 2));
  } else {
    console.log(`Usage:
  node src/cli.js ingest --source the-shashi --codes 2801,2897
  EDINET_API_KEY=... node src/cli.js ingest --source edinet --date 2026-06-26 --codes 2801,2897
  node src/cli.js reconcile --codes 2801,2897
  node src/cli.js export-static --output ../../docs/api/company-intelligence`);
  }
} finally {
  await store.close();
}
