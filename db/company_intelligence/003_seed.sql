\set ON_ERROR_STOP on

BEGIN;

INSERT INTO company_intelligence.source
    (source_key, source_name, authority, base_url, officiality, redistribution_allowed, license_note, metadata)
VALUES
    ('EDINET_V2', 'EDINET API Version 2', '金融庁', 'https://api.edinet-fsa.go.jp/api/v2', 'official', true,
     'Public disclosure documents. API key required. Preserve document IDs and original URLs.',
     '{"auth":"Subscription-Key","preferred_download_type":5,"spec_updated":"2026-06-03"}'::jsonb),
    ('COMPANY_IR', 'Company investor-relations disclosures', 'Issuing companies', 'https://', 'company_official', true,
     'Company-specific terms may apply. Store canonical source URL and publication date.', '{}'::jsonb),
    ('THE_SHASHI', 'The社史 public JSON API', 'The社史', 'https://the-shashi.com/api', 'secondary', false,
     'Reference and reconciliation source only by default. Do not redistribute qualitative content without permission.',
     '{"authentication":"none","cors":true,"default_export_allowed":false}'::jsonb),
    ('DERIVED', 'Investor normalized and calculated data', 'KAFKA2306/investor', 'https://github.com/KAFKA2306/investor', 'derived', true,
     'Derived facts require fact_lineage and transformation metadata.', '{}'::jsonb)
ON CONFLICT (source_key) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    authority = EXCLUDED.authority,
    base_url = EXCLUDED.base_url,
    officiality = EXCLUDED.officiality,
    redistribution_allowed = EXCLUDED.redistribution_allowed,
    license_note = EXCLUDED.license_note,
    metadata = EXCLUDED.metadata;

INSERT INTO company_intelligence.company
    (edinet_code, sec_code, legal_name_ja, legal_name_en, industry_code, fiscal_year_end_month, fiscal_year_end_day, listed_market, metadata)
VALUES
    ('E00435', '2801', 'キッコーマン株式会社', 'Kikkoman Corporation', 'FOOD', 3, 31, 'TSE Prime', '{"bootstrap":"food-analysis"}'::jsonb),
    ('E00457', '2897', '日清食品ホールディングス株式会社', 'Nissin Foods Holdings Co., Ltd.', 'FOOD', 3, 31, 'TSE Prime', '{"bootstrap":"food-analysis"}'::jsonb)
ON CONFLICT (sec_code) DO UPDATE SET
    edinet_code = EXCLUDED.edinet_code,
    legal_name_ja = EXCLUDED.legal_name_ja,
    legal_name_en = EXCLUDED.legal_name_en,
    industry_code = EXCLUDED.industry_code,
    fiscal_year_end_month = EXCLUDED.fiscal_year_end_month,
    fiscal_year_end_day = EXCLUDED.fiscal_year_end_day,
    listed_market = EXCLUDED.listed_market,
    updated_at = now();

INSERT INTO company_intelligence.fact_concept
    (concept_key, statement_type, label_ja, label_en, value_type, canonical_unit, instant_or_duration, aggregation_rule, aliases)
VALUES
    ('revenue', 'PL', '売上収益', 'Revenue', 'monetary', 'JPY', 'duration', 'none', '["NetSales","Revenue","OperatingRevenue","売上高","売上収益"]'::jsonb),
    ('operating_profit', 'PL', '営業利益', 'Operating profit', 'monetary', 'JPY', 'duration', 'none', '["OperatingIncome","OperatingProfitLoss","営業利益"]'::jsonb),
    ('profit_attributable_to_owners', 'PL', '親会社の所有者に帰属する利益', 'Profit attributable to owners', 'monetary', 'JPY', 'duration', 'none', '["ProfitLossAttributableToOwnersOfParent","NetIncomeLossAttributableToOwnersOfParent","親会社株主に帰属する当期純利益"]'::jsonb),
    ('total_assets', 'BS', '資産合計', 'Total assets', 'monetary', 'JPY', 'instant', 'none', '["Assets","TotalAssets","資産合計"]'::jsonb),
    ('inventory', 'BS', '棚卸資産', 'Inventories', 'monetary', 'JPY', 'instant', 'none', '["Inventories","棚卸資産","商品及び製品","原材料及び貯蔵品"]'::jsonb),
    ('property_plant_equipment', 'BS', '有形固定資産', 'Property plant and equipment', 'monetary', 'JPY', 'instant', 'none', '["PropertyPlantAndEquipment","PropertyPlantAndEquipmentNet","有形固定資産"]'::jsonb),
    ('goodwill', 'BS', 'のれん', 'Goodwill', 'monetary', 'JPY', 'instant', 'none', '["Goodwill","のれん"]'::jsonb),
    ('equity', 'BS', '資本合計', 'Total equity', 'monetary', 'JPY', 'instant', 'none', '["Equity","TotalEquity","純資産合計","資本合計"]'::jsonb),
    ('equity_attributable_to_owners', 'BS', '親会社の所有者に帰属する持分', 'Equity attributable to owners', 'monetary', 'JPY', 'instant', 'none', '["EquityAttributableToOwnersOfParent","ShareholdersEquity","自己資本"]'::jsonb),
    ('cash_and_cash_equivalents', 'BS', '現金及び現金同等物', 'Cash and cash equivalents', 'monetary', 'JPY', 'instant', 'none', '["CashAndCashEquivalents","CashAndDeposits","現金及び現金同等物","現金及び預金"]'::jsonb),
    ('interest_bearing_debt', 'BS', '有利子負債', 'Interest-bearing debt', 'monetary', 'JPY', 'instant', 'sum_components', '["InterestBearingDebt","Borrowings","BondsAndBorrowings","有利子負債"]'::jsonb),
    ('operating_cash_flow', 'CF', '営業活動によるキャッシュ・フロー', 'Cash flows from operating activities', 'monetary', 'JPY', 'duration', 'none', '["NetCashProvidedByUsedInOperatingActivities","CashFlowsFromUsedInOperatingActivities","営業活動によるキャッシュフロー"]'::jsonb),
    ('investing_cash_flow', 'CF', '投資活動によるキャッシュ・フロー', 'Cash flows from investing activities', 'monetary', 'JPY', 'duration', 'none', '["NetCashProvidedByUsedInInvestingActivities","CashFlowsFromUsedInInvestingActivities","投資活動によるキャッシュフロー"]'::jsonb),
    ('financing_cash_flow', 'CF', '財務活動によるキャッシュ・フロー', 'Cash flows from financing activities', 'monetary', 'JPY', 'duration', 'none', '["NetCashProvidedByUsedInFinancingActivities","CashFlowsFromUsedInFinancingActivities","財務活動によるキャッシュフロー"]'::jsonb),
    ('employees', 'WORKFORCE', '従業員数', 'Employees', 'count', 'persons', 'instant', 'none', '["NumberOfEmployees","従業員数"]'::jsonb),
    ('average_employee_age', 'WORKFORCE', '平均年齢', 'Average employee age', 'decimal', 'years', 'instant', 'none', '["AverageAgeOfEmployees","平均年齢"]'::jsonb),
    ('average_employee_tenure', 'WORKFORCE', '平均勤続年数', 'Average employee tenure', 'decimal', 'years', 'instant', 'none', '["AverageLengthOfServiceYears","平均勤続年数"]'::jsonb),
    ('average_annual_salary', 'WORKFORCE', '平均年間給与', 'Average annual salary', 'monetary', 'JPY', 'duration', 'none', '["AverageAnnualSalary","平均年間給与"]'::jsonb),
    ('average_annual_salary_yoy_change', 'WORKFORCE', '平均年間給与の対前事業年度増減率', 'Average annual salary year-over-year change', 'decimal', 'percent', 'duration', 'none', '["AverageAnnualSalaryYearOverYearChange","平均年間給与の対前事業年度増減率"]'::jsonb)
ON CONFLICT (concept_key) DO UPDATE SET
    statement_type = EXCLUDED.statement_type,
    label_ja = EXCLUDED.label_ja,
    label_en = EXCLUDED.label_en,
    value_type = EXCLUDED.value_type,
    canonical_unit = EXCLUDED.canonical_unit,
    instant_or_duration = EXCLUDED.instant_or_duration,
    aggregation_rule = EXCLUDED.aggregation_rule,
    aliases = EXCLUDED.aliases;

COMMIT;
