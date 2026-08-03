import pg from "pg";
import { classifyDifference, normalizeSecurityCode, sha256Hex } from "./normalization.js";

const { Pool } = pg;

export class Store {
  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = new Pool(connectionString ? { connectionString } : undefined);
  }

  async close() { await this.pool.end(); }
  async query(text, values = []) { return this.pool.query(text, values); }

  async health() {
    const result = await this.query("select current_database() as database, now() as now");
    return { status: "ok", ...result.rows[0] };
  }

  async listCompanies({ q = "", industry = "", limit = 100, offset = 0 } = {}) {
    const result = await this.query(`
      select * from company_intelligence.v_company_profile
      where ($1 = '' or legal_name_ja ilike '%' || $1 || '%' or coalesce(legal_name_en, '') ilike '%' || $1 || '%' or sec_code = $1 or edinet_code = $1)
        and ($2 = '' or industry_code = $2)
      order by sec_code nulls last
      limit $3 offset $4`, [q, industry, limit, offset]);
    return result.rows;
  }

  async resolveCompany(code) {
    const normalized = /^\d{4,5}$/.test(code) ? normalizeSecurityCode(code) : code;
    const result = await this.query(`select * from company_intelligence.v_company_profile where sec_code = $1 or edinet_code = $1 limit 1`, [normalized]);
    return result.rows[0] ?? null;
  }

  async manifest(code) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`select * from company_intelligence.v_api_manifest where sec_code = $1`, [normalized]);
    return result.rows[0] ?? null;
  }

  async latestFinancials(code) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`select * from company_intelligence.v_latest_financials where sec_code = $1`, [normalized]);
    return result.rows[0] ?? null;
  }

  async financialHistory(code, concept = "", limit = 500) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`
      select * from company_intelligence.v_financial_history
      where sec_code = $1 and ($2 = '' or concept_key = $2)
      order by coalesce(period_end, instant_date) desc, concept_key nulls last
      limit $3`, [normalized, concept, limit]);
    return result.rows;
  }

  async filings(code, limit = 100) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`
      select f.* from company_intelligence.filing f join company_intelligence.company c using(company_id)
      where c.sec_code = $1 order by submitted_at desc nulls last limit $2`, [normalized, limit]);
    return result.rows;
  }

  async timeline(code, limit = 500) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`
      select t.event_date, t.event_year, t.event_type, t.title, t.description, t.significance, t.source_url, s.source_key
      from company_intelligence.timeline_event t
      join company_intelligence.company c using(company_id)
      join company_intelligence.source s using(source_id)
      where c.sec_code = $1 and (t.export_allowed or s.redistribution_allowed)
      order by event_date nulls last, event_year nulls last limit $2`, [normalized, limit]);
    return result.rows;
  }

  async reconciliation(code) {
    const normalized = normalizeSecurityCode(code);
    const result = await this.query(`select * from company_intelligence.v_source_conflict where sec_code = $1 order by period_end desc nulls last`, [normalized]);
    return result.rows;
  }

  async factProvenance(factId) {
    const fact = await this.query(`
      select h.*, rd.canonical_url, rd.content_sha256, rd.retrieved_at, rd.resource_type
      from company_intelligence.v_financial_history h
      left join company_intelligence.fact f on f.fact_id = h.fact_id
      left join company_intelligence.raw_document rd on rd.raw_document_id = f.raw_document_id
      where h.fact_id = $1`, [factId]);
    const lineage = await this.query(`
      select fl.*, input.element_id as input_element_id, input.value_numeric as input_value_numeric, src.source_key as input_source
      from company_intelligence.fact_lineage fl
      join company_intelligence.fact input on input.fact_id = fl.input_fact_id
      join company_intelligence.source src on src.source_id = input.source_id
      where fl.derived_fact_id = $1`, [factId]);
    return fact.rows[0] ? { fact: fact.rows[0], lineage: lineage.rows } : null;
  }

  async compare(codes, concepts = []) {
    const normalized = codes.map(normalizeSecurityCode);
    const result = await this.query(`
      select * from company_intelligence.v_financial_history
      where sec_code = any($1::text[]) and (cardinality($2::text[]) = 0 or concept_key = any($2::text[]))
      order by concept_key, coalesce(period_end, instant_date) desc, sec_code`, [normalized, concepts]);
    return result.rows;
  }

  async sourceId(sourceKey) {
    const result = await this.query(`select source_id from company_intelligence.source where source_key = $1`, [sourceKey]);
    if (!result.rows[0]) throw new Error(`source not seeded: ${sourceKey}`);
    return result.rows[0].source_id;
  }

  async companyId(secCode) {
    const result = await this.query(`select company_id from company_intelligence.company where sec_code = $1`, [normalizeSecurityCode(secCode)]);
    if (!result.rows[0]) throw new Error(`company not seeded: ${secCode}`);
    return result.rows[0].company_id;
  }

  async startRun(sourceKey, scope) {
    const sourceId = await this.sourceId(sourceKey);
    const runKey = `${sourceKey.toLowerCase()}-${new Date().toISOString()}-${crypto.randomUUID()}`;
    const result = await this.query(`insert into company_intelligence.ingestion_run(run_key, source_id, status, scope, code_version) values($1,$2,'running',$3,$4) returning *`, [runKey, sourceId, scope, process.env.GITHUB_SHA ?? "local"]);
    return result.rows[0];
  }

  async finishRun(runId, status, counters = {}, errors = []) {
    await this.query(`update company_intelligence.ingestion_run set completed_at=now(), status=$2, fetched_count=$3, inserted_count=$4, updated_count=$5, error_count=$6, error_detail=$7 where ingestion_run_id=$1`, [runId, status, counters.fetched ?? 0, counters.inserted ?? 0, counters.updated ?? 0, errors.length, errors]);
  }

  async saveRawDocument({ sourceKey, companyId, runId, externalId, resourceType, canonicalUrl, payload, contentSha256, exportAllowed = false, metadata = {} }) {
    const sourceId = await this.sourceId(sourceKey);
    const sha = contentSha256 ?? await sha256Hex(JSON.stringify(payload));
    const result = await this.query(`
      insert into company_intelligence.raw_document(source_id, company_id, ingestion_run_id, external_id, resource_type, canonical_url, content_sha256, content_type, payload, export_allowed, metadata)
      values($1,$2,$3,$4,$5,$6,$7,'application/json',$8,$9,$10)
      on conflict(source_id, external_id, content_sha256) do update set retrieved_at=now(), ingestion_run_id=excluded.ingestion_run_id
      returning raw_document_id`, [sourceId, companyId, runId, externalId, resourceType, canonicalUrl, sha, payload, exportAllowed, metadata]);
    return result.rows[0].raw_document_id;
  }

  async saveSecondaryFacts({ companyId, sourceKey, rawDocumentId, facts, fiscalYear = null, periodEnd = null }) {
    const sourceId = await this.sourceId(sourceKey);
    let inserted = 0;
    for (const fact of facts) {
      const concept = fact.conceptKey ? await this.query(`select fact_concept_id from company_intelligence.fact_concept where concept_key=$1`, [fact.conceptKey]) : { rows: [] };
      await this.query(`
        insert into company_intelligence.fact(company_id, source_id, raw_document_id, fact_concept_id, element_id, label, fiscal_year, period_end, value_numeric, value_text, quality_flag, source_priority, metadata)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'secondary',50,$11)
        on conflict do nothing`, [companyId, sourceId, rawDocumentId, concept.rows[0]?.fact_concept_id ?? null, fact.elementId, fact.label, fiscalYear, periodEnd, fact.valueNumeric, fact.valueText ?? null, fact.metadata ?? {}]);
      inserted += 1;
    }
    return inserted;
  }

  async reconcileCompany(secCode) {
    const companyId = await this.companyId(secCode);
    const pairs = await this.query(`
      select official.fact_id official_fact_id, secondary.fact_id comparison_fact_id, official.fact_concept_id,
             coalesce(official.period_end, official.instant_date) period_end,
             official.value_numeric official_value, secondary.value_numeric comparison_value
      from company_intelligence.fact official
      join company_intelligence.source os on os.source_id=official.source_id and os.officiality='official'
      join company_intelligence.fact secondary on secondary.company_id=official.company_id and secondary.fact_concept_id=official.fact_concept_id
        and coalesce(secondary.period_end, secondary.instant_date)=coalesce(official.period_end, official.instant_date)
      join company_intelligence.source ss on ss.source_id=secondary.source_id and ss.officiality='secondary'
      where official.company_id=$1 and official.value_numeric is not null and secondary.value_numeric is not null`, [companyId]);
    let count = 0;
    for (const pair of pairs.rows) {
      const diff = classifyDifference(Number(pair.official_value), Number(pair.comparison_value));
      await this.query(`
        insert into company_intelligence.reconciliation_issue(company_id,fact_concept_id,period_end,official_fact_id,comparison_fact_id,issue_type,absolute_difference,relative_difference)
        values($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict(company_id,fact_concept_id,period_end,official_fact_id,comparison_fact_id)
        do update set issue_type=excluded.issue_type, absolute_difference=excluded.absolute_difference, relative_difference=excluded.relative_difference`, [companyId, pair.fact_concept_id, pair.period_end, pair.official_fact_id, pair.comparison_fact_id, diff.issueType, diff.absoluteDifference, diff.relativeDifference]);
      count += 1;
    }
    return count;
  }
}
