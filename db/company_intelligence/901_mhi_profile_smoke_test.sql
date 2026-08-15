\set ON_ERROR_STOP on

DO $$
DECLARE
    profile_fact_count integer;
    employee_consolidated numeric;
    employee_standalone numeric;
    orders_consolidated numeric;
    orders_standalone numeric;
    revenue_consolidated numeric;
    revenue_standalone numeric;
BEGIN
    SELECT count(*) INTO profile_fact_count
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    JOIN company_intelligence.raw_document rd USING (raw_document_id)
    WHERE c.sec_code = '7011'
      AND s.source_key = 'COMPANY_IR'
      AND rd.external_id = 'MHI-COMPANY-PROFILE-2026-03-31'
      AND x.quality_flag = 'company_official';

    IF profile_fact_count <> 6 THEN
        RAISE EXCEPTION 'expected 6 verified MHI company-profile facts, got %', profile_fact_count;
    END IF;

    SELECT x.value_numeric INTO employee_consolidated
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'employees'
      AND x.context_id = 'MHIProfile20260331Consolidated';

    SELECT x.value_numeric INTO employee_standalone
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'employees'
      AND x.context_id = 'MHIProfile20260331Standalone';

    SELECT x.value_numeric INTO orders_consolidated
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'order_intake'
      AND x.context_id = 'MHIProfileFY2025Consolidated';

    SELECT x.value_numeric INTO orders_standalone
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'order_intake'
      AND x.context_id = 'MHIProfileFY2025Standalone';

    SELECT x.value_numeric INTO revenue_consolidated
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'revenue'
      AND x.context_id = 'MHIProfileFY2025Consolidated';

    SELECT x.value_numeric INTO revenue_standalone
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.fact_concept fc USING (fact_concept_id)
    WHERE c.sec_code = '7011'
      AND fc.concept_key = 'revenue'
      AND x.context_id = 'MHIProfileFY2025Standalone';

    IF employee_consolidated <> 78793 OR employee_standalone <> 23373 THEN
        RAISE EXCEPTION 'unexpected MHI employee facts: consolidated %, standalone %', employee_consolidated, employee_standalone;
    END IF;
    IF orders_consolidated <> 7653600000000 OR orders_standalone <> 4177700000000 THEN
        RAISE EXCEPTION 'unexpected MHI order-intake facts: consolidated %, standalone %', orders_consolidated, orders_standalone;
    END IF;
    IF revenue_consolidated <> 4974100000000 OR revenue_standalone <> 2396200000000 THEN
        RAISE EXCEPTION 'unexpected MHI revenue facts: consolidated %, standalone %', revenue_consolidated, revenue_standalone;
    END IF;
END $$;
