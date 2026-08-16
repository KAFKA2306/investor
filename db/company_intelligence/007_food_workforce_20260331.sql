\set ON_ERROR_STOP on

BEGIN;

-- Verified standalone workforce facts from FY2025 Annual Securities Reports.
-- Kikkoman official filing: https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf
-- Nissin Foods Holdings official filing: https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf
-- Both workforce tables are as of 2026-03-31.

WITH run_input(run_key, sec_code, source_url, filing_date, fact_hash) AS (
    VALUES
        (
            'company-official-kikkoman-workforce-2026-03-31',
            '2801',
            'https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf',
            '2026-06-19'::date,
            '1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9'
        ),
        (
            'company-official-nissin-workforce-2026-03-31',
            '2897',
            'https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf',
            '2026-06-22'::date,
            '3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21'
        )
)
INSERT INTO company_intelligence.ingestion_run
    (run_key, source_id, started_at, completed_at, status, scope, fetched_count, inserted_count,
     updated_count, error_count, error_detail, code_version, metadata)
SELECT
    i.run_key,
    s.source_id,
    '2026-08-16T11:45:00+09:00'::timestamptz,
    '2026-08-16T11:45:00+09:00'::timestamptz,
    'succeeded',
    jsonb_build_object(
        'sec_code', i.sec_code,
        'as_of_date', '2026-03-31',
        'period_start', '2025-04-01',
        'period_end', '2026-03-31'
    ),
    1, 4, 0, 0, '[]'::jsonb, 'repository-seed-v1',
    jsonb_build_object(
        'method', 'manual-primary-source-verification',
        'verified_on', '2026-08-16',
        'source_url', i.source_url,
        'filing_date', i.filing_date,
        'hash_scope', 'canonical_normalized_fact_bundle_not_pdf_bytes',
        'fact_bundle_sha256', i.fact_hash
    )
FROM run_input i
CROSS JOIN company_intelligence.source s
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

WITH doc_input(
    sec_code, run_key, external_id, canonical_url, filing_date, content_sha256, payload
) AS (
    VALUES
        (
            '2801',
            'company-official-kikkoman-workforce-2026-03-31',
            'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE',
            'https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf',
            '2026-06-19'::date,
            '1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9',
            '{"as_of_date":"2026-03-31","period_start":"2025-04-01","period_end":"2026-03-31","facts":[{"concept":"average_employee_age","scope":"standalone","unit":"years","value":43.1},{"concept":"average_employee_tenure","scope":"standalone","unit":"years","value":13.4},{"concept":"average_annual_salary","scope":"standalone","unit":"JPY","value":8210646},{"concept":"average_annual_salary_yoy_change","scope":"standalone","unit":"percent","value":-0.3}],"source_url":"https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf","filing_date":"2026-06-19"}'::jsonb
        ),
        (
            '2897',
            'company-official-nissin-workforce-2026-03-31',
            'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE',
            'https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf',
            '2026-06-22'::date,
            '3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21',
            '{"as_of_date":"2026-03-31","period_start":"2025-04-01","period_end":"2026-03-31","facts":[{"concept":"average_employee_age","scope":"standalone","unit":"years","value":39.5},{"concept":"average_employee_tenure","scope":"standalone","unit":"years","value":8.7},{"concept":"average_annual_salary","scope":"standalone","unit":"JPY","value":8425365},{"concept":"average_annual_salary_yoy_change","scope":"standalone","unit":"percent","value":-4.3}],"source_url":"https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf","filing_date":"2026-06-22"}'::jsonb
        )
)
INSERT INTO company_intelligence.raw_document
    (source_id, company_id, ingestion_run_id, external_id, resource_type, canonical_url,
     effective_at, retrieved_at, content_sha256, content_type, payload, storage_path,
     export_allowed, metadata)
SELECT
    s.source_id,
    c.company_id,
    r.ingestion_run_id,
    i.external_id,
    'annual_securities_report_pdf',
    i.canonical_url,
    '2026-03-31T00:00:00+09:00'::timestamptz,
    '2026-08-16T11:45:00+09:00'::timestamptz,
    i.content_sha256,
    'application/json',
    i.payload,
    NULL,
    true,
    jsonb_build_object(
        'official_company_source', true,
        'language', 'ja',
        'filing_date', i.filing_date,
        'hash_scope', 'canonical_normalized_fact_bundle_not_pdf_bytes'
    )
FROM doc_input i
JOIN company_intelligence.company c ON c.sec_code = i.sec_code
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.ingestion_run r ON r.run_key = i.run_key
ON CONFLICT (source_id, external_id, content_sha256) DO UPDATE SET
    ingestion_run_id = EXCLUDED.ingestion_run_id,
    canonical_url = EXCLUDED.canonical_url,
    effective_at = EXCLUDED.effective_at,
    retrieved_at = EXCLUDED.retrieved_at,
    payload = EXCLUDED.payload,
    export_allowed = EXCLUDED.export_allowed,
    metadata = EXCLUDED.metadata;

WITH workforce_fact(
    sec_code, source_url, filing_date, source_external_id, source_hash,
    concept_key, element_id, label, context_id, period_start, period_end, instant_date,
    fiscal_year, consolidated, unit_id, unit_label, value_numeric, metadata
) AS (
    VALUES
        ('2801','https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf','2026-06-19'::date,'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9',
         'average_employee_age','kikkoman_fy2025:average_employee_age','平均年齢','KikkomanWorkforce20260331Standalone',NULL::date,NULL::date,'2026-03-31'::date,2025,false,'years','years',43.1::numeric,
         '{"scope":"standalone","reported_text":"平均年齢 43.1歳（2026年3月31日現在）"}'::jsonb),
        ('2801','https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf','2026-06-19'::date,'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9',
         'average_employee_tenure','kikkoman_fy2025:average_employee_tenure','平均勤続年数','KikkomanWorkforce20260331Standalone',NULL::date,NULL::date,'2026-03-31'::date,2025,false,'years','years',13.4::numeric,
         '{"scope":"standalone","reported_text":"平均勤続年数 13.4年（2026年3月31日現在）"}'::jsonb),
        ('2801','https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf','2026-06-19'::date,'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9',
         'average_annual_salary','kikkoman_fy2025:average_annual_salary','平均年間給与','KikkomanWorkforceFY2025Standalone','2025-04-01'::date,'2026-03-31'::date,NULL::date,2025,false,'JPY','JPY',8210646::numeric,
         '{"scope":"standalone","reported_text":"平均年間給与 8,210,646円","definition":"基準外手当及び賞与を含む。"}'::jsonb),
        ('2801','https://www.kikkoman.com/jp/ir/assets/2801_2026yh.pdf','2026-06-19'::date,'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','1bf74f9938976dceb7fa87a6d28f23342a902405c47a51611e72edd6882e59a9',
         'average_annual_salary_yoy_change','kikkoman_fy2025:average_annual_salary_yoy_change','平均年間給与の対前事業年度増減率','KikkomanWorkforceFY2025Standalone','2025-04-01'::date,'2026-03-31'::date,NULL::date,2025,false,'percent','percent',-0.3::numeric,
         '{"scope":"standalone","reported_text":"平均年間給与の対前事業年度増減率 △0.3%"}'::jsonb),
        ('2897','https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf','2026-06-22'::date,'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21',
         'average_employee_age','nissin_fy2025:average_employee_age','平均年齢','NissinWorkforce20260331Standalone',NULL::date,NULL::date,'2026-03-31'::date,2025,false,'years','years',39.5::numeric,
         '{"scope":"standalone","reported_text":"平均年齢 39.5歳（2026年3月31日現在）","population_note":"受入出向者8名を除く972名に基づく。"}'::jsonb),
        ('2897','https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf','2026-06-22'::date,'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21',
         'average_employee_tenure','nissin_fy2025:average_employee_tenure','平均勤続年数','NissinWorkforce20260331Standalone',NULL::date,NULL::date,'2026-03-31'::date,2025,false,'years','years',8.7::numeric,
         '{"scope":"standalone","reported_text":"平均勤続年数 8.7年（2026年3月31日現在）","population_note":"受入出向者8名を除く972名に基づく。"}'::jsonb),
        ('2897','https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf','2026-06-22'::date,'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21',
         'average_annual_salary','nissin_fy2025:average_annual_salary','平均年間給与','NissinWorkforceFY2025Standalone','2025-04-01'::date,'2026-03-31'::date,NULL::date,2025,false,'JPY','JPY',8425365::numeric,
         '{"scope":"standalone","reported_text":"平均年間給与 8,425,365円","definition":"賞与及び基準外賃金を含む。12か月分給与支払いのあった契約社員を除く当社従業員795名を対象。"}'::jsonb),
        ('2897','https://media.www.nissin.com/jp/company/ir/library/security/pdf/ysh_2603_04.pdf','2026-06-22'::date,'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE','3891e65b2ebad2ba883dbe83b0723fef0e32d38aae1d18a62fa945ec76512a21',
         'average_annual_salary_yoy_change','nissin_fy2025:average_annual_salary_yoy_change','平均年間給与の対前事業年度増減率','NissinWorkforceFY2025Standalone','2025-04-01'::date,'2026-03-31'::date,NULL::date,2025,false,'percent','percent',-4.3::numeric,
         '{"scope":"standalone","reported_text":"平均年間給与の対前事業年度増減率 △4.3%"}'::jsonb)
)
INSERT INTO company_intelligence.fact
    (company_id, source_id, raw_document_id, fact_concept_id, element_id, label, context_id,
     period_start, period_end, instant_date, fiscal_year, accounting_standard, consolidated,
     relative_fiscal_year, unit_id, unit_label, decimals_text, value_numeric, dimensions,
     quality_flag, source_priority, revision, metadata)
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
        'source_url', wf.source_url,
        'filing_date', wf.filing_date,
        'verified_on', '2026-08-16',
        'source_external_id', wf.source_external_id
    )
FROM workforce_fact wf
JOIN company_intelligence.company c ON c.sec_code = wf.sec_code
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.raw_document rd
  ON rd.source_id = s.source_id
 AND rd.company_id = c.company_id
 AND rd.external_id = wf.source_external_id
 AND rd.content_sha256 = wf.source_hash
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
