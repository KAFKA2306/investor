\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE VIEW market_data.v_curve_observation AS
SELECT
    s.series_key,
    s.series_name,
    s.country_code,
    s.currency_code,
    s.measure,
    s.curve_family,
    s.tenor_years,
    s.tenor_label,
    s.unit,
    s.frequency,
    s.quote_type,
    s.methodology,
    s.is_derived,
    o.observed_on,
    o.observed_at,
    o.value,
    o.quality_flag,
    src.source_key,
    src.source_name,
    src.authority,
    src.source_url,
    o.metadata AS observation_metadata,
    s.metadata AS series_metadata
FROM market_data.observation o
JOIN market_data.series s USING (series_id)
JOIN market_data.source src USING (source_id);

CREATE OR REPLACE VIEW market_data.v_latest_curve_point AS
SELECT DISTINCT ON (s.series_id)
    s.series_key,
    s.series_name,
    s.country_code,
    s.measure,
    s.curve_family,
    s.tenor_years,
    s.tenor_label,
    s.unit,
    o.observed_on,
    o.observed_at,
    o.value,
    o.quality_flag,
    s.methodology
FROM market_data.series s
JOIN market_data.observation o USING (series_id)
WHERE s.measure IN ('nominal_yield', 'real_yield', 'yield_spread')
ORDER BY s.series_id, o.observed_on DESC, o.revision DESC;

CREATE OR REPLACE VIEW market_data.v_us_japan_real_spread AS
SELECT
    o.observed_on,
    s.tenor_years,
    s.tenor_label,
    o.value AS us_minus_japan_percentage_points,
    o.quality_flag,
    s.methodology,
    o.metadata
FROM market_data.observation o
JOIN market_data.series s USING (series_id)
WHERE s.curve_family = 'US_JP_REAL_SPREAD'
ORDER BY o.observed_on, s.tenor_years;

CREATE OR REPLACE VIEW market_data.v_monthly_usdjpy_rate_spreads AS
SELECT
    fx.observed_on AS month,
    fx.value AS usdjpy_monthly_average,
    spread_2y.value AS nominal_spread_2y_percentage_points,
    spread_10y.value AS nominal_spread_10y_percentage_points
FROM market_data.observation fx
JOIN market_data.series fx_series
  ON fx_series.series_id = fx.series_id
 AND fx_series.series_key = 'USDJPY_MONTHLY_AVG'
JOIN market_data.series spread_2y_series
  ON spread_2y_series.series_key = 'USJP_NOMINAL_SPREAD_2Y_MONTHLY'
JOIN market_data.observation spread_2y
  ON spread_2y.series_id = spread_2y_series.series_id
 AND spread_2y.observed_on = fx.observed_on
JOIN market_data.series spread_10y_series
  ON spread_10y_series.series_key = 'USJP_NOMINAL_SPREAD_10Y_MONTHLY'
JOIN market_data.observation spread_10y
  ON spread_10y.series_id = spread_10y_series.series_id
 AND spread_10y.observed_on = fx.observed_on
ORDER BY fx.observed_on;

COMMIT;
