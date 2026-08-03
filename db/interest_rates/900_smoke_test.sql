\set ON_ERROR_STOP on

DO $$
DECLARE
    source_count integer;
    series_count integer;
    observation_count integer;
    real_spread_count integer;
    monthly_count integer;
BEGIN
    SELECT count(*) INTO source_count FROM market_data.source;
    SELECT count(*) INTO series_count FROM market_data.series;
    SELECT count(*) INTO observation_count FROM market_data.observation;
    SELECT count(*) INTO real_spread_count FROM market_data.v_us_japan_real_spread;
    SELECT count(*) INTO monthly_count FROM market_data.v_monthly_usdjpy_rate_spreads;

    IF source_count < 6 THEN
        RAISE EXCEPTION 'expected at least 6 sources, got %', source_count;
    END IF;
    IF series_count < 53 THEN
        RAISE EXCEPTION 'expected at least 53 series, got %', series_count;
    END IF;
    IF observation_count < 86 THEN
        RAISE EXCEPTION 'expected at least 86 observations, got %', observation_count;
    END IF;
    IF real_spread_count <> 3 THEN
        RAISE EXCEPTION 'expected 3 real-spread rows, got %', real_spread_count;
    END IF;
    IF monthly_count <> 12 THEN
        RAISE EXCEPTION 'expected 12 monthly rows, got %', monthly_count;
    END IF;
END $$;

SELECT * FROM market_data.v_us_japan_real_spread;
SELECT * FROM market_data.v_monthly_usdjpy_rate_spreads ORDER BY month DESC LIMIT 3;
