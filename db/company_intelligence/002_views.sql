\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE VIEW company_intelligence.v_company_profile AS
SELECT
    c.company_id,
    c.edinet_code,
    c.sec_code,
    c.jcn,
    c.legal_name_ja,
    c.legal_name_en,
    c.industry_code,
    c.listed_market,
    c.active,
    max(coalesce(f.period_end, f.instant_date)) FILTER (
        WHERE coalesce(f.dimensions ->> 'scenario', 'actual') = 'actual'
    ) AS latest_period_end,
    count(DISTINCT f.filing_id) FILTER (WHERE f.filing_id IS NOT NULL) AS filing_count,
    count(DISTINCT f.fact_id) AS fact_count,
    count(DISTINCT t.timeline_event_id) AS timeline_event_count
FROM company_intelligence.company c
LEFT JOIN company_intelligence.fact f ON f.company_id = c.company_id
LEFT JOIN company_intelligence.timeline_event t ON t.company_id = c.company_id
GROUP BY c.company_id;

CREATE OR REPLACE VIEW company_intelligence.v_best_fact AS
SELECT DISTINCT ON (
    f.company_id,
    coalesce(f.fact_concept_id, 0),
    f.element_id,
    coalesce(f.period_end, f.instant_date),
    coalesce(f.consolidated, false),
    coalesce(f.unit_id, '')
)
    f.*,
    fc.concept_key,
    fc.statement_type,
    fc.label_ja AS canonical_label_ja,
    s.source_key,
    s.source_name,
    s.officiality,
    s.base_url
FROM company_intelligence.fact f
JOIN company_intelligence.source s USING (source_id)
LEFT JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
ORDER BY
    f.company_id,
    coalesce(f.fact_concept_id, 0),
    f.element_id,
    coalesce(f.period_end, f.instant_date),
    coalesce(f.consolidated, false),
    coalesce(f.unit_id, ''),
    f.source_priority ASC,
    f.revision DESC,
    f.inserted_at DESC;

CREATE OR REPLACE VIEW company_intelligence.v_financial_history AS
SELECT
    c.sec_code,
    c.edinet_code,
    c.legal_name_ja,
    fc.concept_key,
    fc.statement_type,
    fc.label_ja,
    f.fiscal_year,
    f.period_start,
    f.period_end,
    f.instant_date,
    f.consolidated,
    f.accounting_standard,
    f.value_numeric,
    f.value_text,
    coalesce(f.unit_label, fc.canonical_unit) AS unit,
    f.quality_flag,
    s.source_key,
    f.element_id,
    f.context_id,
    f.fact_id,
    f.dimensions,
    f.metadata AS fact_metadata
FROM company_intelligence.v_best_fact f
JOIN company_intelligence.company c USING (company_id)
JOIN company_intelligence.source s USING (source_id)
LEFT JOIN company_intelligence.fact_concept fc USING (fact_concept_id);

CREATE OR REPLACE VIEW company_intelligence.v_latest_financials AS
WITH ranked AS (
    SELECT
        h.*,
        dense_rank() OVER (PARTITION BY h.sec_code ORDER BY coalesce(h.period_end, h.instant_date) DESC) AS period_rank
    FROM company_intelligence.v_financial_history h
    WHERE h.consolidated IS DISTINCT FROM false
      AND coalesce(h.dimensions ->> 'scenario', 'actual') = 'actual'
)
SELECT
    sec_code,
    edinet_code,
    legal_name_ja,
    max(coalesce(period_end, instant_date)) AS period_end,
    max(value_numeric) FILTER (WHERE concept_key = 'revenue') AS revenue,
    max(value_numeric) FILTER (WHERE concept_key = 'operating_profit') AS operating_profit,
    max(value_numeric) FILTER (WHERE concept_key = 'profit_attributable_to_owners') AS profit_attributable_to_owners,
    max(value_numeric) FILTER (WHERE concept_key = 'total_assets') AS total_assets,
    max(value_numeric) FILTER (WHERE concept_key = 'equity_attributable_to_owners') AS equity_attributable_to_owners,
    max(value_numeric) FILTER (WHERE concept_key = 'cash_and_cash_equivalents') AS cash_and_cash_equivalents,
    max(value_numeric) FILTER (WHERE concept_key = 'operating_cash_flow') AS operating_cash_flow,
    max(value_numeric) FILTER (WHERE concept_key = 'investing_cash_flow') AS investing_cash_flow,
    max(value_numeric) FILTER (WHERE concept_key = 'financing_cash_flow') AS financing_cash_flow,
    jsonb_object_agg(concept_key, jsonb_build_object(
        'value', value_numeric,
        'unit', unit,
        'source', source_key,
        'fact_id', fact_id,
        'element_id', element_id,
        'context_id', context_id,
        'dimensions', dimensions
    )) FILTER (WHERE concept_key IS NOT NULL) AS facts,
    max(value_numeric) FILTER (WHERE concept_key = 'business_profit') AS business_profit,
    max(value_numeric) FILTER (WHERE concept_key = 'profit_before_tax') AS profit_before_tax,
    max(value_numeric) FILTER (WHERE concept_key = 'profit_for_period') AS profit_for_period,
    max(value_numeric) FILTER (WHERE concept_key = 'order_intake') AS order_intake,
    max(value_numeric) FILTER (WHERE concept_key = 'order_backlog') AS order_backlog,
    max(value_numeric) FILTER (WHERE concept_key = 'basic_eps') AS basic_eps,
    max(value_numeric) FILTER (WHERE concept_key = 'owners_equity_ratio') AS owners_equity_ratio,
    max(value_numeric) FILTER (WHERE concept_key = 'accounts_receivable') AS accounts_receivable,
    max(value_numeric) FILTER (WHERE concept_key = 'contract_assets') AS contract_assets,
    max(value_numeric) FILTER (WHERE concept_key = 'contract_liabilities') AS contract_liabilities,
    max(value_numeric) FILTER (WHERE concept_key = 'net_interest_bearing_debt') AS net_interest_bearing_debt
FROM ranked
WHERE period_rank = 1
GROUP BY sec_code, edinet_code, legal_name_ja;

CREATE OR REPLACE VIEW company_intelligence.v_source_conflict AS
SELECT
    r.reconciliation_issue_id,
    c.sec_code,
    c.legal_name_ja,
    fc.concept_key,
    r.period_end,
    r.issue_type,
    r.absolute_difference,
    r.relative_difference,
    r.status,
    official.value_numeric AS official_value,
    comparison.value_numeric AS comparison_value,
    official.element_id AS official_element_id,
    comparison.element_id AS comparison_element_id
FROM company_intelligence.reconciliation_issue r
JOIN company_intelligence.company c USING (company_id)
LEFT JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
LEFT JOIN company_intelligence.fact official ON official.fact_id = r.official_fact_id
LEFT JOIN company_intelligence.fact comparison ON comparison.fact_id = r.comparison_fact_id;

CREATE OR REPLACE VIEW company_intelligence.v_api_manifest AS
SELECT
    c.sec_code,
    c.edinet_code,
    c.legal_name_ja,
    jsonb_build_object(
        'profile', format('/v1/companies/%s', c.sec_code),
        'financials', format('/v1/companies/%s/financials', c.sec_code),
        'facts', format('/v1/companies/%s/facts', c.sec_code),
        'filings', format('/v1/companies/%s/filings', c.sec_code),
        'timeline', format('/v1/companies/%s/timeline', c.sec_code),
        'reconciliation', format('/v1/companies/%s/reconciliation', c.sec_code),
        'compatibility_manifest', format('/api/%s/manifest.json', c.sec_code),
        'compatibility_financials', format('/api/%s/financials.json', c.sec_code),
        'compatibility_timeline', format('/api/%s/timeline.json', c.sec_code)
    ) AS resources
FROM company_intelligence.company c
WHERE c.active;

COMMIT;
