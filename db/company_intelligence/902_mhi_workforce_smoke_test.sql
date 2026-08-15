\set ON_ERROR_STOP on

DO $$
DECLARE
    workforce_fact_count integer;
    avg_age numeric;
    avg_tenure numeric;
    avg_salary numeric;
    salary_yoy numeric;
BEGIN
    SELECT count(*) INTO workforce_fact_count
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    JOIN company_intelligence.raw_document rd USING (raw_document_id)
    WHERE c.sec_code = '7011'
      AND s.source_key = 'COMPANY_IR'
      AND rd.external_id = 'MHI-ANNUAL-SECURITIES-REPORT-FY2025-WORKFORCE'
      AND x.quality_flag = 'company_official';

    IF workforce_fact_count <> 4 THEN
        RAISE EXCEPTION 'expected 4 verified MHI workforce facts, got %', workforce_fact_count;
    END IF;

    SELECT x.value_numeric INTO avg_age
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'average_employee_age'
      AND x.context_id = 'MHIWorkforce20260331Standalone';

    SELECT x.value_numeric INTO avg_tenure
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'average_employee_tenure'
      AND x.context_id = 'MHIWorkforce20260331Standalone';

    SELECT x.value_numeric INTO avg_salary
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'average_annual_salary'
      AND x.context_id = 'MHIWorkforceFY2025Standalone';

    SELECT x.value_numeric INTO salary_yoy
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'average_annual_salary_yoy_change'
      AND x.context_id = 'MHIWorkforceFY2025Standalone';

    IF avg_age <> 42.3 THEN
        RAISE EXCEPTION 'unexpected MHI average age: %', avg_age;
    END IF;
    IF avg_tenure <> 18.5 THEN
        RAISE EXCEPTION 'unexpected MHI average tenure: %', avg_tenure;
    END IF;
    IF avg_salary <> 10724514 THEN
        RAISE EXCEPTION 'unexpected MHI average annual salary: %', avg_salary;
    END IF;
    IF salary_yoy <> 5.4 THEN
        RAISE EXCEPTION 'unexpected MHI salary YoY change: %', salary_yoy;
    END IF;
END $$;
