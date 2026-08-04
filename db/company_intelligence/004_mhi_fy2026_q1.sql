\set ON_ERROR_STOP on

BEGIN;

-- Company and reusable concepts. EDINET code is intentionally left NULL until verified from EDINET itself.
INSERT INTO company_intelligence.company AS target
    (edinet_code, sec_code, legal_name_ja, legal_name_en, industry_code, fiscal_year_end_month, fiscal_year_end_day, listed_market, metadata)
VALUES
    (NULL, '7011', '三菱重工業株式会社', 'Mitsubishi Heavy Industries, Ltd.', 'MACHINERY', 3, 31,
     'TSE/NSE/FSE/SSE',
     '{"bootstrap":"mhi-fy2026-q1","company_profile_url":"https://www.mhi.com/jp/company/overview/profile","stock_information_url":"https://www.mhi.com/jp/finance/stock/status"}'::jsonb)
ON CONFLICT (sec_code) DO UPDATE SET
    legal_name_ja = EXCLUDED.legal_name_ja,
    legal_name_en = EXCLUDED.legal_name_en,
    industry_code = EXCLUDED.industry_code,
    fiscal_year_end_month = EXCLUDED.fiscal_year_end_month,
    fiscal_year_end_day = EXCLUDED.fiscal_year_end_day,
    listed_market = EXCLUDED.listed_market,
    metadata = target.metadata || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO company_intelligence.fact_concept
    (concept_key, statement_type, label_ja, label_en, value_type, canonical_unit, instant_or_duration, aggregation_rule, aliases)
VALUES
    ('order_intake', 'KPI', '受注高', 'Order intake', 'monetary', 'JPY', 'duration', 'none', '["OrdersReceived","OrderIntake","受注高"]'::jsonb),
    ('order_backlog', 'KPI', '受注残高', 'Order backlog', 'monetary', 'JPY', 'instant', 'none', '["OrderBacklog","受注残高"]'::jsonb),
    ('business_profit', 'PL', '事業利益', 'Profit from business activities', 'monetary', 'JPY', 'duration', 'none', '["BusinessProfit","ProfitFromBusinessActivities","事業利益"]'::jsonb),
    ('profit_before_tax', 'PL', '税引前利益', 'Profit before tax', 'monetary', 'JPY', 'duration', 'none', '["ProfitLossBeforeTax","ProfitBeforeTax","税引前利益","税引前四半期利益"]'::jsonb),
    ('profit_for_period', 'PL', '当期利益', 'Profit for the period', 'monetary', 'JPY', 'duration', 'none', '["ProfitLoss","ProfitForThePeriod","当期利益","四半期利益"]'::jsonb),
    ('basic_eps', 'KPI', '基本的1株当たり利益', 'Basic earnings per share', 'ratio', 'JPY_per_share', 'duration', 'none', '["BasicEarningsLossPerShare","BasicEPS","基本的1株当たり利益"]'::jsonb),
    ('owners_equity_ratio', 'KPI', '親会社所有者帰属持分比率', 'Ratio of equity attributable to owners', 'percentage', 'percent', 'instant', 'none', '["RatioOfEquityAttributableToOwnersOfParent","自己資本比率","親会社所有者帰属持分比率"]'::jsonb),
    ('accounts_receivable', 'BS', '売上債権', 'Trade receivables', 'monetary', 'JPY', 'instant', 'none', '["TradeAndOtherReceivables","AccountsReceivable","売上債権"]'::jsonb),
    ('contract_assets', 'BS', '契約資産', 'Contract assets', 'monetary', 'JPY', 'instant', 'none', '["ContractAssets","契約資産"]'::jsonb),
    ('contract_liabilities', 'BS', '契約負債', 'Contract liabilities', 'monetary', 'JPY', 'instant', 'none', '["ContractLiabilities","契約負債"]'::jsonb),
    ('net_interest_bearing_debt', 'BS', '純有利子負債', 'Net interest-bearing debt', 'monetary', 'JPY', 'instant', 'none', '["NetInterestBearingDebt","NetDebt","純有利子負債"]'::jsonb),
    ('business_profit_margin', 'KPI', '事業利益率', 'Business profit margin', 'percentage', 'percent', 'duration', 'none', '["BusinessProfitMargin","事業利益率"]'::jsonb),
    ('proceeds_from_business_disposals', 'CF', '事業売却による収入', 'Proceeds from disposal of businesses', 'monetary', 'JPY', 'duration', 'none', '["ProceedsFromDisposalOfBusinesses","事業の売却による収入"]'::jsonb)
ON CONFLICT (concept_key) DO UPDATE SET
    statement_type = EXCLUDED.statement_type,
    label_ja = EXCLUDED.label_ja,
    label_en = EXCLUDED.label_en,
    value_type = EXCLUDED.value_type,
    canonical_unit = EXCLUDED.canonical_unit,
    instant_or_duration = EXCLUDED.instant_or_duration,
    aggregation_rule = EXCLUDED.aggregation_rule,
    aliases = EXCLUDED.aliases;

INSERT INTO company_intelligence.ingestion_run
    (run_key, source_id, started_at, completed_at, status, scope, fetched_count, inserted_count, updated_count, error_count, error_detail, code_version, metadata)
SELECT
    'company-ir-mhi-fy2026-q1-2026-08-04', s.source_id,
    '2026-08-04T18:05:00+09:00'::timestamptz, '2026-08-04T18:05:00+09:00'::timestamptz,
    'succeeded', '{"sec_code":"7011","fiscal_year":2026,"quarter":"Q1"}'::jsonb,
    2, 0, 0, 0, '[]'::jsonb, 'repository-seed-v1',
    '{"method":"manual-primary-source-bootstrap","verified_on":"2026-08-04"}'::jsonb
FROM company_intelligence.source s
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (run_key) DO UPDATE SET
    completed_at = EXCLUDED.completed_at,
    status = EXCLUDED.status,
    scope = EXCLUDED.scope,
    fetched_count = EXCLUDED.fetched_count,
    error_count = 0,
    error_detail = '[]'::jsonb,
    code_version = EXCLUDED.code_version,
    metadata = EXCLUDED.metadata;

INSERT INTO company_intelligence.raw_document
    (source_id, company_id, ingestion_run_id, external_id, resource_type, canonical_url, effective_at, retrieved_at, content_sha256, content_type, payload, storage_path, export_allowed, metadata)
SELECT
    s.source_id, c.company_id, r.ingestion_run_id, 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'quarterly_results_pdf', 'https://www.mhi.com/jp/finance/library/result/pdf/fy20261q/kessan_tansin.pdf',
    '2026-08-04T00:00:00+09:00'::timestamptz, '2026-08-04T18:05:00+09:00'::timestamptz,
    'e9ac0704f305471dbce7c9f760426f9e84c4ac597be13ad3661c2f145de22e9c', 'application/pdf', '{"title":"2027年3月期 第1四半期決算短信〔IFRS〕（連結）","period_start":"2026-04-01","period_end":"2026-06-30","publication_date":"2026-08-04"}'::jsonb, NULL, true,
    '{"hash_scope":"downloaded_pdf_bytes","language":"ja","official_company_ir":true}'::jsonb
FROM company_intelligence.source s
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.ingestion_run r ON r.run_key = 'company-ir-mhi-fy2026-q1-2026-08-04'
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (source_id, external_id, content_sha256) DO UPDATE SET
    ingestion_run_id = EXCLUDED.ingestion_run_id,
    canonical_url = EXCLUDED.canonical_url,
    effective_at = EXCLUDED.effective_at,
    retrieved_at = EXCLUDED.retrieved_at,
    payload = EXCLUDED.payload,
    metadata = EXCLUDED.metadata;

INSERT INTO company_intelligence.raw_document
    (source_id, company_id, ingestion_run_id, external_id, resource_type, canonical_url, effective_at, retrieved_at, content_sha256, content_type, payload, storage_path, export_allowed, metadata)
SELECT
    s.source_id, c.company_id, r.ingestion_run_id, 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'quarterly_results_presentation_pdf', 'https://www.mhi.com/jp/finance/library/result/pdf/fy20261q/presentation.pdf',
    '2026-08-04T00:00:00+09:00'::timestamptz, '2026-08-04T18:05:00+09:00'::timestamptz,
    'bc53b6c0750c3207b15dbced26c7e86044f2cbb700e426caa726988ff74e0e43', 'application/pdf', '{"title":"2026年度第1四半期決算説明資料","period_start":"2026-04-01","period_end":"2026-06-30","publication_date":"2026-08-04"}'::jsonb, NULL, true,
    '{"hash_scope":"downloaded_pdf_bytes","language":"ja","official_company_ir":true}'::jsonb
FROM company_intelligence.source s
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.ingestion_run r ON r.run_key = 'company-ir-mhi-fy2026-q1-2026-08-04'
WHERE s.source_key = 'COMPANY_IR'
ON CONFLICT (source_id, external_id, content_sha256) DO UPDATE SET
    ingestion_run_id = EXCLUDED.ingestion_run_id,
    canonical_url = EXCLUDED.canonical_url,
    effective_at = EXCLUDED.effective_at,
    retrieved_at = EXCLUDED.retrieved_at,
    payload = EXCLUDED.payload,
    metadata = EXCLUDED.metadata;

INSERT INTO company_intelligence.filing
    (company_id, source_id, raw_document_id, doc_id, doc_type_code, ordinance_code, form_code, filing_name, submitted_at, period_start, period_end, accounting_standard, consolidated, xbrl_available, csv_available, pdf_available, metadata)
SELECT
    c.company_id, s.source_id, rd.raw_document_id, 'MHI-FY2026-Q1-2026-08-04', 'COMPANY_IR_Q1', NULL, NULL,
    '2027年3月期 第1四半期決算短信〔IFRS〕（連結）', '2026-08-04T00:00:00+09:00'::timestamptz,
    '2026-04-01'::date, '2026-06-30'::date, 'IFRS', true, false, false, true,
    '{"fiscal_year_label":"FY2026","quarter":"Q1","presentation_external_id":"MHI-FY2026-Q1-PRESENTATION-2026-08-04"}'::jsonb
FROM company_intelligence.company c
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.raw_document rd ON rd.source_id = s.source_id AND rd.external_id = 'MHI-FY2026-Q1-KESSAN-2026-08-04' AND rd.content_sha256 = 'e9ac0704f305471dbce7c9f760426f9e84c4ac597be13ad3661c2f145de22e9c'
WHERE c.sec_code = '7011'
ON CONFLICT (source_id, doc_id) DO UPDATE SET
    raw_document_id = EXCLUDED.raw_document_id,
    filing_name = EXCLUDED.filing_name,
    submitted_at = EXCLUDED.submitted_at,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    accounting_standard = EXCLUDED.accounting_standard,
    consolidated = EXCLUDED.consolidated,
    pdf_available = true,
    metadata = EXCLUDED.metadata;

-- Replace only this company-IR snapshot, leaving EDINET and other sources untouched.
DELETE FROM company_intelligence.segment_fact sf
USING company_intelligence.company c, company_intelligence.source s, company_intelligence.filing f
WHERE sf.company_id = c.company_id
  AND sf.source_id = s.source_id
  AND sf.filing_id = f.filing_id
  AND c.sec_code = '7011'
  AND s.source_key = 'COMPANY_IR'
  AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04';

DELETE FROM company_intelligence.fact x
USING company_intelligence.company c, company_intelligence.source s, company_intelligence.filing f
WHERE x.company_id = c.company_id
  AND x.source_id = s.source_id
  AND x.filing_id = f.filing_id
  AND c.sec_code = '7011'
  AND s.source_key = 'COMPANY_IR'
  AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04';

WITH seed(concept_key, raw_external_id, element_id, label, context_id, period_start, period_end, instant_date, fiscal_year, accounting_standard, consolidated, relative_fiscal_year, unit_id, unit_label, decimals_text, value_numeric, metadata) AS (
    VALUES
        ('revenue', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:revenue', '売上収益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 1034109000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('business_profit', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:business_profit', '事業利益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 96690000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('profit_before_tax', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_before_tax', '税引前四半期利益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 88663000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('profit_for_period', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_for_period', '四半期利益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 71425000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('profit_attributable_to_owners', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_attributable_to_owners', '親会社の所有者に帰属する四半期利益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 68227000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('operating_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:operating_cash_flow', '営業活動によるキャッシュ・フロー', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 89661000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":9}'::jsonb),
        ('investing_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:investing_cash_flow', '投資活動によるキャッシュ・フロー', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', -25309000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('financing_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:financing_cash_flow', '財務活動によるキャッシュ・フロー', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', -47886000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('basic_eps', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:basic_eps', '基本的1株当たり四半期利益', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY_per_share', 'JPY_per_share', '2', 20.32, '{"scenario":"actual","reported_scale":"JPY_per_share","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('proceeds_from_business_disposals', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:proceeds_from_business_disposals', '事業（子会社を含む）の売却による収入', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, 'IFRS', true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 4574000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('revenue', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:revenue', '売上収益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 1194203000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('business_profit', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:business_profit', '事業利益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 159645000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('profit_before_tax', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_before_tax', '税引前四半期利益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 176426000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_operations","source_page":1}'::jsonb),
        ('profit_for_period', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_for_period', '四半期利益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 138143000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('profit_attributable_to_owners', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_attributable_to_owners', '親会社の所有者に帰属する四半期利益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 134680000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('operating_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:operating_cash_flow', '営業活動によるキャッシュ・フロー', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 284598000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":9}'::jsonb),
        ('investing_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:investing_cash_flow', '投資活動によるキャッシュ・フロー', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 106913000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('financing_cash_flow', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:financing_cash_flow', '財務活動によるキャッシュ・フロー', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', -82153000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('basic_eps', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:basic_eps', '基本的1株当たり四半期利益', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY_per_share', 'JPY_per_share', '2', 40.08, '{"scenario":"actual","reported_scale":"JPY_per_share","scope":"continuing_and_discontinued_operations","source_page":1}'::jsonb),
        ('proceeds_from_business_disposals', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:proceeds_from_business_disposals', '事業（子会社を含む）の売却による収入', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, 'IFRS', true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 146166000000, '{"scenario":"actual","reported_scale":"JPY_million","scope":"consolidated_cash_flows","source_page":10}'::jsonb),
        ('order_intake', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:order_intake', '受注高', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, NULL, true, 'PriorYearQuarter', 'JPY', 'JPY', '0', 1609200000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":5,"rounded_down_below_JPY_100_million":true}'::jsonb),
        ('business_profit_margin', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:business_profit_margin', '事業利益率', 'FY2025Q1Duration', '2025-04-01'::date, '2025-06-30'::date, NULL::date, 2025, NULL, true, 'PriorYearQuarter', 'percent', 'percent', '1', 9.4, '{"scenario":"actual","reported_scale":"percent","source_page":5}'::jsonb),
        ('order_intake', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:order_intake', '受注高', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, NULL, true, 'CurrentYearQuarter', 'JPY', 'JPY', '0', 2022400000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":5,"rounded_down_below_JPY_100_million":true}'::jsonb),
        ('business_profit_margin', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:business_profit_margin', '事業利益率', 'FY2026Q1Duration', '2026-04-01'::date, '2026-06-30'::date, NULL::date, 2026, NULL, true, 'CurrentYearQuarter', 'percent', 'percent', '1', 13.4, '{"scenario":"actual","reported_scale":"percent","source_page":5}'::jsonb),
        ('total_assets', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:total_assets', '資産合計', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 8269711000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('equity', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:equity', '資本合計', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 3228400000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('equity_attributable_to_owners', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:equity_attributable_to_owners', '親会社の所有者に帰属する持分', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 3088566000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('owners_equity_ratio', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:owners_equity_ratio', '親会社所有者帰属持分比率', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'percent', 'percent', '1', 37.3, '{"scenario":"actual","reported_scale":"percent","source_page":1}'::jsonb),
        ('cash_and_cash_equivalents', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:cash_and_cash_equivalents', '現金及び現金同等物', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 1334874000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('accounts_receivable', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:accounts_receivable', '売上債権', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 1108557000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('contract_assets', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:contract_assets', '契約資産', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 1019196000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('inventory', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:inventory', '棚卸資産', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 1041899000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('contract_liabilities', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:contract_liabilities', '契約負債', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, 'IFRS', true, 'PriorYearEnd', 'JPY', 'JPY', '0', 2161881000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":5}'::jsonb),
        ('total_assets', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:total_assets', '資産合計', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 8151335000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('equity', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:equity', '資本合計', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 3239575000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('equity_attributable_to_owners', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:equity_attributable_to_owners', '親会社の所有者に帰属する持分', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 3171235000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":1}'::jsonb),
        ('owners_equity_ratio', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:owners_equity_ratio', '親会社所有者帰属持分比率', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'percent', 'percent', '1', 38.9, '{"scenario":"actual","reported_scale":"percent","source_page":1}'::jsonb),
        ('cash_and_cash_equivalents', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:cash_and_cash_equivalents', '現金及び現金同等物', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 1684084000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('accounts_receivable', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:accounts_receivable', '売上債権', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 828020000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('contract_assets', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:contract_assets', '契約資産', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 1070336000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('inventory', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:inventory', '棚卸資産', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 1154881000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":4}'::jsonb),
        ('contract_liabilities', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:contract_liabilities', '契約負債', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, 'IFRS', true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 2483221000000, '{"scenario":"actual","reported_scale":"JPY_million","source_page":5}'::jsonb),
        ('order_backlog', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:order_backlog', '受注残高', 'FY2025YEInstant', NULL::date, NULL::date, '2026-03-31'::date, 2025, NULL, true, 'PriorYearEnd', 'JPY', 'JPY', '0', 13237600000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":22}'::jsonb),
        ('order_backlog', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:order_backlog', '受注残高', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, NULL, true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 14103000000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":22}'::jsonb),
        ('interest_bearing_debt', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:interest_bearing_debt', '有利子負債', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, NULL, true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', 519800000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":5}'::jsonb),
        ('net_interest_bearing_debt', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:net_interest_bearing_debt', '純有利子負債', 'FY2026Q1Instant', NULL::date, NULL::date, '2026-06-30'::date, 2026, NULL, true, 'CurrentQuarterEnd', 'JPY', 'JPY', '0', -1164200000000, '{"scenario":"actual","reported_scale":"JPY_100_million","source_page":5,"sign_convention":"debt_minus_cash"}'::jsonb),
        ('order_intake', 'MHI-FY2026-Q1-PRESENTATION-2026-08-04', 'mhi_ir:order_intake:forecast', '受注高（通期見通し）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, NULL, true, 'ForecastYear', 'JPY', 'JPY', '0', 7000000000000, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_100_million","source_page":1}'::jsonb),
        ('revenue', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:revenue:forecast', '売上収益（通期予想）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, 'IFRS', true, 'ForecastYear', 'JPY', 'JPY', '0', 5400000000000, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_million","source_page":2}'::jsonb),
        ('business_profit', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:business_profit:forecast', '事業利益（通期予想）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, 'IFRS', true, 'ForecastYear', 'JPY', 'JPY', '0', 540000000000, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_million","source_page":2}'::jsonb),
        ('profit_before_tax', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_before_tax:forecast', '税引前利益（通期予想）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, 'IFRS', true, 'ForecastYear', 'JPY', 'JPY', '0', 530000000000, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_million","source_page":2}'::jsonb),
        ('profit_attributable_to_owners', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:profit_attributable_to_owners:forecast', '親会社の所有者に帰属する当期利益（通期予想）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, 'IFRS', true, 'ForecastYear', 'JPY', 'JPY', '0', 380000000000, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_million","source_page":2}'::jsonb),
        ('basic_eps', 'MHI-FY2026-Q1-KESSAN-2026-08-04', 'mhi_ir:basic_eps:forecast', '基本的1株当たり当期利益（通期予想）', 'FY2026ForecastDuration', '2026-04-01'::date, '2027-03-31'::date, NULL::date, 2026, 'IFRS', true, 'ForecastYear', 'JPY_per_share', 'JPY_per_share', '2', 113.09, '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_type":"annual","forward_looking":true,"reported_scale":"JPY_per_share","source_page":2}'::jsonb)
)
INSERT INTO company_intelligence.fact
    (company_id, source_id, filing_id, raw_document_id, fact_concept_id, element_id, label, context_id, period_start, period_end, instant_date, fiscal_year, accounting_standard, consolidated, relative_fiscal_year, unit_id, unit_label, decimals_text, value_numeric, quality_flag, source_priority, revision, dimensions, metadata)
SELECT
    c.company_id, s.source_id, f.filing_id, rd.raw_document_id, fc.fact_concept_id,
    seed.element_id, seed.label, seed.context_id, seed.period_start, seed.period_end, seed.instant_date, seed.fiscal_year,
    seed.accounting_standard, seed.consolidated, seed.relative_fiscal_year, seed.unit_id, seed.unit_label, seed.decimals_text, seed.value_numeric,
    'company_official', 10, 0,
    jsonb_build_object(
        'scenario', coalesce(seed.metadata->>'scenario', 'actual'),
        'period_type', CASE WHEN seed.instant_date IS NOT NULL THEN 'instant' WHEN seed.metadata->>'scenario' = 'company_forecast' THEN 'annual' ELSE 'quarter' END,
        'quarter', CASE WHEN seed.context_id LIKE '%Q1%' AND seed.metadata->>'scenario' <> 'company_forecast' THEN 'Q1' ELSE NULL END
    ),
    seed.metadata
FROM seed
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.filing f ON f.source_id = s.source_id AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04'
JOIN company_intelligence.raw_document rd ON rd.source_id = s.source_id AND rd.external_id = seed.raw_external_id
    AND rd.content_sha256 = CASE seed.raw_external_id
        WHEN 'MHI-FY2026-Q1-KESSAN-2026-08-04' THEN 'e9ac0704f305471dbce7c9f760426f9e84c4ac597be13ad3661c2f145de22e9c'
        WHEN 'MHI-FY2026-Q1-PRESENTATION-2026-08-04' THEN 'bc53b6c0750c3207b15dbced26c7e86044f2cbb700e426caa726988ff74e0e43'
    END
JOIN company_intelligence.fact_concept fc ON fc.concept_key = seed.concept_key;

WITH seed(fiscal_year, segment_name, metric_key, value_numeric, unit, dimensions, quality_flag) AS (
    VALUES
        (2025, 'エナジー', 'order_intake', 871300000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー', 'revenue', 423200000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー', 'business_profit', 56400000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'order_intake', 1359300000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'revenue', 536300000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'business_profit', 101300000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'プラント・インフラ', 'order_intake', 239500000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'プラント・インフラ', 'revenue', 207900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'プラント・インフラ', 'business_profit', 18500000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'プラント・インフラ', 'order_intake', 368800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'プラント・インフラ', 'revenue', 200000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'プラント・インフラ', 'business_profit', 21700000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'インダストリアル・ソリューション', 'order_intake', 162700000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'インダストリアル・ソリューション', 'revenue', 154600000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'インダストリアル・ソリューション', 'business_profit', 4000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'インダストリアル・ソリューション', 'order_intake', 193000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'インダストリアル・ソリューション', 'revenue', 177900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'インダストリアル・ソリューション', 'business_profit', 9900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, '航空・防衛・宇宙', 'order_intake', 350800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, '航空・防衛・宇宙', 'revenue', 260500000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, '航空・防衛・宇宙', 'business_profit', 28800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, '航空・防衛・宇宙', 'order_intake', 120900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, '航空・防衛・宇宙', 'revenue', 286000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, '航空・防衛・宇宙', 'business_profit', 32400000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'その他及び全社又は消去', 'order_intake', -15200000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'その他及び全社又は消去', 'revenue', -12200000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'その他及び全社又は消去', 'business_profit', -11100000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":10,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'その他及び全社又は消去', 'order_intake', -19700000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'その他及び全社又は消去', 'revenue', -6100000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'その他及び全社又は消去', 'business_profit', -5800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":10,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/GTCC', 'order_intake', 602500000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/GTCC', 'revenue', 196800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/GTCC', 'order_intake', 930000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/GTCC', 'revenue', 274900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/スチームパワー', 'order_intake', 92900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/スチームパワー', 'revenue', 96200000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/スチームパワー', 'order_intake', 160800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/スチームパワー', 'revenue', 86900000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/航空エンジン', 'order_intake', 62800000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/航空エンジン', 'revenue', 59400000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/航空エンジン', 'order_intake', 98600000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/航空エンジン', 'revenue', 76000000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/原子力', 'order_intake', 101400000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー/原子力', 'revenue', 53700000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2025-04-01","period_end":"2025-06-30","source_page":11,"restated_for_2026_reorganization":true,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/原子力', 'order_intake', 155500000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/原子力', 'revenue', 80300000000, 'JPY', '{"scenario":"actual","quarter":"Q1","period_start":"2026-04-01","period_end":"2026-06-30","source_page":11,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'エナジー', 'order_backlog', 6983200000000, 'JPY', '{"scenario":"actual","as_of":"2026-03-31","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'プラント・インフラ', 'order_backlog', 2102800000000, 'JPY', '{"scenario":"actual","as_of":"2026-03-31","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'インダストリアル・ソリューション', 'order_backlog', 87500000000, 'JPY', '{"scenario":"actual","as_of":"2026-03-31","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, '航空・防衛・宇宙', 'order_backlog', 4063200000000, 'JPY', '{"scenario":"actual","as_of":"2026-03-31","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2025, 'その他及び全社又は消去', 'order_backlog', 800000000, 'JPY', '{"scenario":"actual","as_of":"2026-03-31","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'order_backlog', 7814600000000, 'JPY', '{"scenario":"actual","as_of":"2026-06-30","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'プラント・インフラ', 'order_backlog', 2286100000000, 'JPY', '{"scenario":"actual","as_of":"2026-06-30","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'インダストリアル・ソリューション', 'order_backlog', 103200000000, 'JPY', '{"scenario":"actual","as_of":"2026-06-30","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, '航空・防衛・宇宙', 'order_backlog', 3898300000000, 'JPY', '{"scenario":"actual","as_of":"2026-06-30","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'その他及び全社又は消去', 'order_backlog', 600000000, 'JPY', '{"scenario":"actual","as_of":"2026-06-30","source_page":22,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'order_intake', 3550000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'revenue', 2200000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー', 'business_profit', 340000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/GTCC', 'order_intake', 2400000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/GTCC', 'revenue', 1100000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/スチームパワー', 'order_intake', 330000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/スチームパワー', 'revenue', 330000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/航空エンジン', 'order_intake', 260000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/航空エンジン', 'revenue', 260000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/原子力', 'order_intake', 450000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official'),
        (2026, 'エナジー/原子力', 'revenue', 400000000000, 'JPY', '{"scenario":"company_forecast","forecast_as_of":"2026-08-04","period_start":"2026-04-01","period_end":"2027-03-31","source_page":18,"reported_scale":"JPY_100_million"}'::jsonb, 'company_official')
)
INSERT INTO company_intelligence.segment_fact
    (company_id, source_id, filing_id, raw_document_id, fiscal_year, segment_name, metric_key, value_numeric, unit, dimensions, quality_flag)
SELECT
    c.company_id, s.source_id, f.filing_id, rd.raw_document_id, seed.fiscal_year, seed.segment_name, seed.metric_key,
    seed.value_numeric, seed.unit, seed.dimensions, seed.quality_flag
FROM seed
JOIN company_intelligence.company c ON c.sec_code = '7011'
JOIN company_intelligence.source s ON s.source_key = 'COMPANY_IR'
JOIN company_intelligence.filing f ON f.source_id = s.source_id AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04'
JOIN company_intelligence.raw_document rd ON rd.source_id = s.source_id AND rd.external_id = 'MHI-FY2026-Q1-PRESENTATION-2026-08-04'
    AND rd.content_sha256 = 'bc53b6c0750c3207b15dbced26c7e86044f2cbb700e426caa726988ff74e0e43';

UPDATE company_intelligence.ingestion_run r
SET inserted_count = (
        SELECT count(*)
        FROM company_intelligence.fact x
        JOIN company_intelligence.company c USING (company_id)
        JOIN company_intelligence.source s USING (source_id)
        JOIN company_intelligence.filing f USING (filing_id)
        WHERE c.sec_code = '7011' AND s.source_key = 'COMPANY_IR' AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04'
    ) + (
        SELECT count(*)
        FROM company_intelligence.segment_fact sf
        JOIN company_intelligence.company c USING (company_id)
        JOIN company_intelligence.source s USING (source_id)
        JOIN company_intelligence.filing f USING (filing_id)
        WHERE c.sec_code = '7011' AND s.source_key = 'COMPANY_IR' AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04'
    )
WHERE r.run_key = 'company-ir-mhi-fy2026-q1-2026-08-04';

COMMIT;
