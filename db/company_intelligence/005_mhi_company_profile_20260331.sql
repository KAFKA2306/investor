\set ON_ERROR_STOP on

BEGIN;

-- Verified company-profile facts published by Mitsubishi Heavy Industries.
-- Source: https://www.mhi.com/jp/company/overview/profile
-- Observed values are explicitly scoped to the dates/periods stated on that page.

INSERT INTO company_intelligence.ingestion_run
    (run_key, source_id, started_at, completed_at, status, scope, fetched_count, inserted_count, updated_count, error_count, error_detail, code_version, metadata)
SELECT
    'company-official-mhi-profile-2026-03-31', s.source_id,
    '2026-08-16T01:09:00+09:00'::timestamptz, '2026-08-16T01:09:00+09:00'::timestamptz,
    'succeeded',
    '{"sec_code":"7011","as_of_date":"2026-03-31","period_start":"2025-04-01","period_end":"2026-03-31"}'::jsonb,
    1, 6, 0, 0, '[]'::jsonb, 'repository-seed-v1',
    '{"method":"manual-primary-source-verification","verified_on":"2026-08-16","source_url":"https://www.mhi.com/jp/company/overview/profile"}'::jsonb
FROM company_intelligence.source s
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (run_key) DO UPDATE SET
    completed_at = EXCLUDED.completed_at,
    status = EXCLUDED.status,
    scope = EXCLUDED.scope,
    fetched_count = EXCLUDED.fetched_count,
    inserted_count = EXCLUDED.inserted_count,
    updated_count = EXCLUDED.updated_count,
    error_count = 0,
    error_detail = '[]'::jsonb,
    code_version = EXCLUDED.code_version,
    metadata = EXCLUDED.metadata;

INSERT INTO company_intelligence.raw_document
    (source_id, company_id, ingestion_run_id, external_id, resource_type, canonical_url, effective_at, retrieved_at, content_sha256, content_type, payload, storage_path, export_allowed, metadata)
SELECT
    s.source_id,
    c.company_id,
    r.ingestion_run_id,
    'MHI-COMPANY-PROFILE-2026-03-31',
    'company_profile_html',
    'https://www.mhi.com/jp/company/overview/profile',
    '2026-03-31T00:00:00+09:00'::timestamptz,
    '2026-08-16T01:09:00+09:00'::timestamptz,
    'cee695edbda33a9a09bc273a669037bc8fbdf00a4ae4c9d4ac693c82b261f45d',
    'application/json',
    '{"as_of_date":"2026-03-31","facts":[{"concept":"employees","consolidated":true,"unit":"persons","value":78793},{"concept":"employees","consolidated":false,"unit":"persons","value":23373},{"concept":"order_intake","consolidated":true,"period_start":"2025-04-01","period_end":"2026-03-31","unit":"JPY","value":7653600000000},{"concept":"order_intake","consolidated":false,"period_start":"2025-04-01","period_end":"2026-03-31","unit":"JPY","value":4177700000000},{"concept":"revenue","consolidated":true,"period_start":"2025-04-01","period_end":"2026-03-31","unit":"JPY","value":4974100000000},{"concept":"revenue","consolidated":false,"period_start":"2025-04-01","period_end":"2026-03-31","unit":"JPY","value":2396200000000}],"source_url":"https://www.mhi.com/jp/company/overview/profile"}'::jsonb,
    NULL,
    true,
    '{"official_company_source":true,"language":"ja","hash_scope":"canonical_normalized_fact_bundle_not_page_bytes","source_page_states_values_as_of":"2026-03-31"}'::jsonb
FROM company_intelligence.source s
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.ingestion_run r ON r.run_key = 'company-official-mhi-profile-2026-03-31'
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (source_id, external_id, content_sha256) DO UPDATE SET
    ingestion_run_id = EXCLUDED.ingestion_run_id,
    canonical_url = EXCLUDED.canonical_url,
    effective_at = EXCLUDED.effective_at,
    retrieved_at = EXCLUDED.retrieved_at,
    payload = EXCLUDED.payload,
    export_allowed = EXCLUDED.export_allowed,
    metadata = EXCLUDED.metadata;

WITH profile_fact(concept_key, element_id, label, context_id, period_start, period_end, instant_date, fiscal_year, consolidated, unit_id, unit_label, value_numeric, metadata) AS (
    VALUES
        ('employees', 'mhi_profile:employees', '社員数', 'MHIProfile20260331Consolidated', NULL::date, NULL::date, '2026-03-31'::date, 2025, true, 'persons', 'persons', 78793::numeric, '{"scope":"consolidated","reported_text":"連結：78,793人（2026年3月31日時点）"}'::jsonb),
        ('employees', 'mhi_profile:employees', '社員数', 'MHIProfile20260331Standalone', NULL::date, NULL::date, '2026-03-31'::date, 2025, false, 'persons', 'persons', 23373::numeric, '{"scope":"standalone","reported_text":"単独：23,373名（2026年3月31日時点）"}'::jsonb),
        ('order_intake', 'mhi_profile:order_intake', '受注高', 'MHIProfileFY2025Consolidated', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, true, 'JPY', 'JPY', 7653600000000::numeric, '{"scope":"consolidated","reported_scale":"JPY_100million","reported_value":76536,"reported_text":"受注高（連結）76,536億円（2025年4月1日～2026年3月31日）"}'::jsonb),
        ('order_intake', 'mhi_profile:order_intake', '受注高', 'MHIProfileFY2025Standalone', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, false, 'JPY', 'JPY', 4177700000000::numeric, '{"scope":"standalone","reported_scale":"JPY_100million","reported_value":41777,"reported_text":"受注高（単独）41,777億円（2025年4月1日～2026年3月31日）"}'::jsonb),
        ('revenue', 'mhi_profile:revenue', '売上収益・売上高', 'MHIProfileFY2025Consolidated', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, true, 'JPY', 'JPY', 4974100000000::numeric, '{"scope":"consolidated","reported_scale":"JPY_100million","reported_value":49741,"reported_label":"売上収益","reported_text":"売上収益（連結）49,741億円（2025年4月1日～2026年3月31日）"}'::jsonb),
        ('revenue', 'mhi_profile:revenue', '売上高', 'MHIProfileFY2025Standalone', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, false, 'JPY', 'JPY', 2396200000000::numeric, '{"scope":"standalone","reported_scale":"JPY_100million","reported_value":23962,"reported_label":"売上高","reported_text":"売上高（単独）23,962億円（2025年4月1日～2026年3月31日）"}'::jsonb)
)
INSERT INTO company_intelligence.fact
    (company_id, source_id, raw_document_id, fact_concept_id, element_id, label, context_id,
     period_start, period_end, instant_date, fiscal_year, accounting_standard, consolidated,
     relative_fiscal_year, unit_id, unit_label, decimals_text, value_numeric,
     dimensions, quality_flag, source_priority, revision, metadata)
SELECT
    c.company_id,
    s.source_id,
    rd.raw_document_id,
    fc.fact_concept_id,
    pf.element_id,
    pf.label,
    pf.context_id,
    pf.period_start,
    pf.period_end,
    pf.instant_date,
    pf.fiscal_year,
    NULL,
    pf.consolidated,
    'CurrentYear',
    pf.unit_id,
    pf.unit_label,
    '0',
    pf.value_numeric,
    jsonb_build_object('source_scope', CASE WHEN pf.consolidated THEN 'consolidated' ELSE 'standalone' END),
    'company_official',
    20,
    0,
    pf.metadata || jsonb_build_object(
        'source_url', 'https://www.mhi.com/jp/company/overview/profile',
        'verified_on', '2026-08-16',
        'source_external_id', 'MHI-COMPANY-PROFILE-2026-03-31'
    )
FROM profile_fact pf
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.raw_document rd
  ON rd.source_id = s.source_id
 AND rd.company_id = c.company_id
 AND rd.external_id = 'MHI-COMPANY-PROFILE-2026-03-31'
 AND rd.content_sha256 = 'cee695edbda33a9a09bc273a669037bc8fbdf00a4ae4c9d4ac693c82b261f45d'
JOIN company_intelligence.fact_concept fc ON fc.concept_key = pf.concept_key
ON CONFLICT NULLS NOT DISTINCT (
    company_id, source_id, filing_id, element_id, context_id,
    period_start, period_end, instant_date, unit_id, revision
) DO UPDATE SET
    raw_document_id = EXCLUDED.raw_document_id,
    fact_concept_id = EXCLUDED.fact_concept_id,
    label = EXCLUDED.label,
    fiscal_year = EXCLUDED.fiscal_year,
    accounting_standard = EXCLUDED.accounting_standard,
    consolidated = EXCLUDED.consolidated,
    relative_fiscal_year = EXCLUDED.relative_fiscal_year,
    unit_label = EXCLUDED.unit_label,
    decimals_text = EXCLUDED.decimals_text,
    value_numeric = EXCLUDED.value_numeric,
    dimensions = EXCLUDED.dimensions,
    quality_flag = EXCLUDED.quality_flag,
    source_priority = EXCLUDED.source_priority,
    metadata = EXCLUDED.metadata;

COMMIT;
