\set ON_ERROR_STOP on

DO $$
DECLARE
    matched integer;
    official_docs integer;
BEGIN
    WITH expected(sec_code, concept_key, expected_value) AS (
        VALUES
            ('2801', 'average_employee_age', 43.1::numeric),
            ('2801', 'average_employee_tenure', 13.4::numeric),
            ('2801', 'average_annual_salary', 8210646::numeric),
            ('2801', 'average_annual_salary_yoy_change', -0.3::numeric),
            ('2897', 'average_employee_age', 39.5::numeric),
            ('2897', 'average_employee_tenure', 8.7::numeric),
            ('2897', 'average_annual_salary', 8425365::numeric),
            ('2897', 'average_annual_salary_yoy_change', -4.3::numeric)
    )
    SELECT count(*) INTO matched
    FROM expected e
    JOIN company_intelligence.company c ON c.sec_code = e.sec_code
    JOIN company_intelligence.fact f ON f.company_id = c.company_id
    JOIN company_intelligence.fact_concept fc
      ON fc.fact_concept_id = f.fact_concept_id
     AND fc.concept_key = e.concept_key
    JOIN company_intelligence.source s ON s.source_id = f.source_id
    WHERE f.value_numeric = e.expected_value
      AND f.fiscal_year = 2025
      AND f.quality_flag = 'company_official'
      AND s.source_key = 'COMPANY_IR';

    IF matched <> 8 THEN
        RAISE EXCEPTION 'expected 8 verified food-company workforce facts, got %', matched;
    END IF;

    SELECT count(*) INTO official_docs
    FROM company_intelligence.raw_document rd
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    WHERE c.sec_code IN ('2801', '2897')
      AND s.source_key = 'COMPANY_IR'
      AND rd.external_id IN (
          'KIKKOMAN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE',
          'NISSIN-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE'
      );

    IF official_docs <> 2 THEN
        RAISE EXCEPTION 'expected 2 official workforce source documents, got %', official_docs;
    END IF;
END $$;
