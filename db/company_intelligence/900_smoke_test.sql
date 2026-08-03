\set ON_ERROR_STOP on

DO $$
DECLARE
    source_count integer;
    company_count integer;
    concept_count integer;
BEGIN
    SELECT count(*) INTO source_count FROM company_intelligence.source;
    SELECT count(*) INTO company_count FROM company_intelligence.company;
    SELECT count(*) INTO concept_count FROM company_intelligence.fact_concept;

    IF source_count < 4 THEN
        RAISE EXCEPTION 'expected at least 4 sources, got %', source_count;
    END IF;
    IF company_count < 2 THEN
        RAISE EXCEPTION 'expected at least 2 companies, got %', company_count;
    END IF;
    IF concept_count < 15 THEN
        RAISE EXCEPTION 'expected at least 15 canonical concepts, got %', concept_count;
    END IF;
END $$;

SELECT * FROM company_intelligence.v_company_profile ORDER BY sec_code;
SELECT * FROM company_intelligence.v_api_manifest ORDER BY sec_code;
