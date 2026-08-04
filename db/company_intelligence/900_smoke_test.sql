\set ON_ERROR_STOP on

DO $$
DECLARE
    source_count integer;
    company_count integer;
    concept_count integer;
    mhi_fact_count integer;
    mhi_segment_count integer;
    mhi_forecast_count integer;
    mhi_operating_profit_count integer;
    mhi_document_count integer;
    latest_actual_period date;
    latest_revenue numeric;
    latest_business_profit numeric;
    latest_operating_cf numeric;
    latest_order_backlog numeric;
BEGIN
    SELECT count(*) INTO source_count FROM company_intelligence.source;
    SELECT count(*) INTO company_count FROM company_intelligence.company;
    SELECT count(*) INTO concept_count FROM company_intelligence.fact_concept;

    IF source_count < 4 THEN
        RAISE EXCEPTION 'expected at least 4 sources, got %', source_count;
    END IF;
    IF company_count < 3 THEN
        RAISE EXCEPTION 'expected at least 3 companies, got %', company_count;
    END IF;
    IF concept_count < 28 THEN
        RAISE EXCEPTION 'expected at least 28 canonical concepts, got %', concept_count;
    END IF;

    SELECT count(*) INTO mhi_document_count
    FROM company_intelligence.raw_document rd
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    WHERE c.sec_code = '7011'
      AND s.source_key = 'COMPANY_IR'
      AND rd.content_sha256 IN (
          'e9ac0704f305471dbce7c9f760426f9e84c4ac597be13ad3661c2f145de22e9c',
          'bc53b6c0750c3207b15dbced26c7e86044f2cbb700e426caa726988ff74e0e43'
      );
    IF mhi_document_count <> 2 THEN
        RAISE EXCEPTION 'expected 2 hashed MHI source documents, got %', mhi_document_count;
    END IF;

    SELECT count(*) INTO mhi_fact_count
    FROM company_intelligence.fact x
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    JOIN company_intelligence.filing f USING (filing_id)
    WHERE c.sec_code = '7011'
      AND s.source_key = 'COMPANY_IR'
      AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04';
    IF mhi_fact_count <> 52 THEN
        RAISE EXCEPTION 'expected 52 MHI company-IR facts, got %', mhi_fact_count;
    END IF;

    SELECT count(*) INTO mhi_segment_count
    FROM company_intelligence.segment_fact sf
    JOIN company_intelligence.company c USING (company_id)
    JOIN company_intelligence.source s USING (source_id)
    JOIN company_intelligence.filing f USING (filing_id)
    WHERE c.sec_code = '7011'
      AND s.source_key = 'COMPANY_IR'
      AND f.doc_id = 'MHI-FY2026-Q1-2026-08-04';
    IF mhi_segment_count <> 67 THEN
        RAISE EXCEPTION 'expected 67 MHI segment facts, got %', mhi_segment_count;
    END IF;

    SELECT count(*) INTO mhi_forecast_count
    FROM company_intelligence.v_financial_history
    WHERE sec_code = '7011'
      AND dimensions ->> 'scenario' = 'company_forecast';
    IF mhi_forecast_count <> 6 THEN
        RAISE EXCEPTION 'expected 6 MHI forecast facts, got %', mhi_forecast_count;
    END IF;

    SELECT count(*) INTO mhi_operating_profit_count
    FROM company_intelligence.v_financial_history
    WHERE sec_code = '7011'
      AND source_key = 'COMPANY_IR'
      AND concept_key = 'operating_profit';
    IF mhi_operating_profit_count <> 0 THEN
        RAISE EXCEPTION 'MHI business profit must not be conflated with operating_profit';
    END IF;

    SELECT latest_period_end INTO latest_actual_period
    FROM company_intelligence.v_company_profile
    WHERE sec_code = '7011';
    IF latest_actual_period <> '2026-06-30'::date THEN
        RAISE EXCEPTION 'forecast leaked into latest actual period: %', latest_actual_period;
    END IF;

    SELECT revenue, business_profit, operating_cash_flow, order_backlog
    INTO latest_revenue, latest_business_profit, latest_operating_cf, latest_order_backlog
    FROM company_intelligence.v_latest_financials
    WHERE sec_code = '7011';

    IF latest_revenue <> 1194203000000 THEN
        RAISE EXCEPTION 'unexpected MHI Q1 revenue: %', latest_revenue;
    END IF;
    IF latest_business_profit <> 159645000000 THEN
        RAISE EXCEPTION 'unexpected MHI Q1 business profit: %', latest_business_profit;
    END IF;
    IF latest_operating_cf <> 284598000000 THEN
        RAISE EXCEPTION 'unexpected MHI Q1 operating cash flow: %', latest_operating_cf;
    END IF;
    IF latest_order_backlog <> 14103000000000 THEN
        RAISE EXCEPTION 'unexpected MHI Q1 order backlog: %', latest_order_backlog;
    END IF;
END $$;

SELECT * FROM company_intelligence.v_company_profile ORDER BY sec_code;
SELECT * FROM company_intelligence.v_api_manifest ORDER BY sec_code;
SELECT sec_code, period_end, revenue, business_profit, operating_cash_flow, order_backlog
FROM company_intelligence.v_latest_financials
WHERE sec_code = '7011';
