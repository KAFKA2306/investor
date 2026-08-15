\set ON_ERROR_STOP on

BEGIN;

-- Verified workforce facts from Mitsubishi Heavy Industries' FY2025 Annual Securities Report.
-- Official filing page: https://www.mhi.com/jp/finance/library/financial
-- PDF: https://www.mhi.com/jp/finance/library/financial/pdf/2025/2025_04_all.pdf
-- Submitted to EDINET on 2026-06-24; workforce table is as of 2026-03-31.

INSERT INTO company_intelligence.ingestion_run
    (run_key, source_id, started_at, completed_at, status, scope, fetched_count, inserted_count, updated_count, error_count, error_detail, code_version, metadata)
SELECT
    'company-official-mhi-workforce-2026-03-31', s.source_id,
    '2026-08-16T05:10:00+09:00'::timestamptz, '2026-08-16T05:10:00+09:00'::timestamptz,
    'succeeded',
    '{"sec_code":"7011","as_of_date":"2026-03-31","period_start":"2025-04-01","period_end":"2026-03-31"}'::jsonb,
    1, 4, 0, 0, '[]'::jsonb, 'repository-seed-v1',
    '{"method":"manual-primary-source-verification","verified_on":"2026-08-16","source_url":"https://www.mhi.com/jp/finance/library/financial/pdf/2025/2025_04_all.pdf","filing_date":"2026-06-24"}'::jsonb
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
    'MHI-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE',
    'annual_securities_report_pdf',
    'https://www.mhi.com/jp/finance/library/financial/pdf/2025/2025_04_all.pdf',
    '2026-03-31T00:00:00+09:00'::timestamptz,
    '2026-08-16T05:10:00+09:00'::timestamptz,
    'f3047e366754e28ff5dd8a4824751454e61baf72bf9fbd20247540259789715b',
    'application/json',
    '{"as_of_date":"2026-03-31","period_start":"2025-04-01","period_end":"2026-03-31","facts":[{"concept":"average_employee_age","scope":"standalone","unit":"years","value":42.3},{"concept":"average_employee_tenure","scope":"standalone","unit":"years","value":18.5},{"concept":"average_annual_salary","scope":"standalone","unit":"JPY","value":10724514},{"concept":"average_annual_salary_yoy_change","scope":"standalone","unit":"percent","value":5.4}],"source_url":"https://www.mhi.com/jp/finance/library/financial/pdf/2025/2025_04_all.pdf","filing_date":"2026-06-24"}'::jsonb,
    NULL,
    true,
    '{"official_company_source":true,"language":"ja","hash_scope":"canonical_normalized_fact_bundle_not_pdf_bytes","source_page":76,"source_pdf_page_index":78}'::jsonb
FROM company_intelligence.source s
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.ingestion_run r ON r.run_key = 'company-official-mhi-workforce-2026-03-31'
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (source_id, external_id, content_sha256) DO UPDATE SET
    ingestion_run_id = EXCLUDED.ingestion_run_id,
    canonical_url = EXCLUDED.canonical_url,
    effective_at = EXCLUDED.effective_at,
    retrieved_at = EXCLUDED.retrieved_at,
    payload = EXCLUDED.payload,
    export_allowed = EXCLUDED.export_allowed,
    metadata = EXCLUDED.metadata;

WITH workforce_fact(concept_key, element_id, label, context_id, period_start, period_end, instant_date, fiscal_year, consolidated, unit_id, unit_label, value_numeric, metadata) AS (
    VALUES
        ('average_employee_age', 'mhi_fy2025:average_employee_age', '平均年齢', 'MHIWorkforce20260331Standalone', NULL::date, NULL::date, '2026-03-31'::date, 2025, false, 'years', 'years', 42.3::numeric, '{"scope":"standalone","reported_text":"平均年齢 42.3歳（2026年3月31日現在）"}'::jsonb),
        ('average_employee_tenure', 'mhi_fy2025:average_employee_tenure', '平均勤続年数', 'MHIWorkforce20260331Standalone', NULL::date, NULL::date, '2026-03-31'::date, 2025, false, 'years', 'years', 18.5::numeric, '{"scope":"standalone","reported_text":"平均勤続年数 18.5年（2026年3月31日現在）"}'::jsonb),
        ('average_annual_salary', 'mhi_fy2025:average_annual_salary', '平均年間給与', 'MHIWorkforceFY2025Standalone', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, false, 'JPY', 'JPY', 10724514::numeric, '{"scope":"standalone","reported_text":"平均年間給与 10,724,514円","definition":"2025年4月から2026年3月までの税込金額。基準外賃金及び賞与を含み、その他の臨時給与を含まない。"}'::jsonb),
        ('average_annual_salary_yoy_change', 'mhi_fy2025:average_annual_salary_yoy_change', '平均年間給与の対前事業年度増減率', 'MHIWorkforceFY2025Standalone', '2025-04-01'::date, '2026-03-31'::date, NULL::date, 2025, false, 'percent', 'percent', 5.4::numeric, '{"scope":"standalone","reported_text":"平均年間給与の対前事業年度増減率 5.4%"}'::jsonb)
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
    wf.element_id,
    wf.label,
    wf.context_id,
    wf.period_start,
    wf.period_end,
    wf.instant_date,
    wf.fiscal_year,
    NULL,
    wf.consolidated,
    'CurrentYear',
    wf.unit_id,
    wf.unit_label,
    CASE WHEN wf.unit_id = 'JPY' THEN '0' ELSE '1' END,
    wf.value_numeric,
    '{"source_scope":"standalone"}'::jsonb,
    'company_official',
    20,
    0,
    wf.metadata || jsonb_build_object(
        'source_url', 'https://www.mhi.com/jp/finance/library/financial/pdf/2025/2025_04_all.pdf',
        'filing_date', '2026-06-24',
        'verified_on', '2026-08-16',
        'source_external_id', 'MHI-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE'
    )
FROM workforce_fact wf
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.raw_document rd
  ON rd.source_id = s.source_id
 AND rd.company_id = c.company_id
 AND rd.external_id = 'MHI-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE'
 AND rd.content_sha256 = 'f3047e366754e28ff5dd8a4824751454e61baf72bf9fbd20247540259789715b'
JOIN company_intelligence.fact_concept fc ON fc.concept_key = wf.concept_key
ON CONFLICT (
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
