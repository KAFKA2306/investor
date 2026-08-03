#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_DIR="$SCRIPT_DIR/seeds"
DB_USER="${POSTGRES_USER:-${PGUSER:-investor}}"
DB_NAME="${POSTGRES_DB:-${PGDATABASE:-investor}}"

psql --username "$DB_USER" --dbname "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

CREATE TEMP TABLE source_seed (
  source_key text, source_name text, authority text, source_url text,
  access_method text, metadata jsonb
);
CREATE TEMP TABLE series_seed (
  series_key text, series_name text, country_code char(2), currency_code char(3),
  measure text, curve_family text, instrument_type text, tenor_years numeric,
  tenor_label text, unit text, frequency text, quote_type text, source_key text,
  methodology text, is_derived boolean, metadata jsonb
);
CREATE TEMP TABLE observation_seed (
  series_key text, observed_on date, observed_at timestamptz, value numeric,
  revision integer, quality_flag text, source_document_url text, metadata jsonb
);
CREATE TEMP TABLE lineage_seed (
  derived_series_key text, derived_observed_on date, input_series_key text,
  input_observed_on date, relation text, weight numeric
);

\copy source_seed FROM '$SEED_DIR/sources.csv' WITH (FORMAT csv, HEADER true)
\copy series_seed FROM '$SEED_DIR/series.csv' WITH (FORMAT csv, HEADER true)
\copy observation_seed FROM '$SEED_DIR/observations.csv' WITH (FORMAT csv, HEADER true)
\copy lineage_seed FROM '$SEED_DIR/lineage.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO market_data.source
  (source_key, source_name, authority, source_url, access_method, metadata)
SELECT source_key, source_name, authority, source_url, access_method, metadata
FROM source_seed
ON CONFLICT (source_key) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  authority = EXCLUDED.authority,
  source_url = EXCLUDED.source_url,
  access_method = EXCLUDED.access_method,
  metadata = EXCLUDED.metadata;

INSERT INTO market_data.ingestion_run
  (run_key, started_at, completed_at, status, code_version, notes, metadata)
VALUES (
  'interest-rate-bootstrap-2026-08-03',
  '2026-08-03T12:15:00+09:00', now(), 'succeeded', 'repository-seed-v1',
  'Official U.S./Japan yield curves, derived real spreads, and monthly USDJPY/nominal spreads.',
  '{"snapshot":"2026-07-31","jp_real_source_time":"2026-07-30T15:00:00+09:00"}'::jsonb
)
ON CONFLICT (run_key) DO UPDATE SET
  completed_at = EXCLUDED.completed_at,
  status = EXCLUDED.status,
  code_version = EXCLUDED.code_version,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata;

INSERT INTO market_data.series (
  series_key, series_name, country_code, currency_code, measure, curve_family,
  instrument_type, tenor_years, tenor_label, unit, frequency, quote_type,
  source_id, methodology, is_derived, metadata
)
SELECT
  x.series_key, x.series_name, x.country_code, x.currency_code, x.measure,
  x.curve_family, x.instrument_type, x.tenor_years, x.tenor_label, x.unit,
  x.frequency, x.quote_type, s.source_id, x.methodology, x.is_derived, x.metadata
FROM series_seed x
JOIN market_data.source s USING (source_key)
ON CONFLICT (series_key) DO UPDATE SET
  series_name = EXCLUDED.series_name,
  country_code = EXCLUDED.country_code,
  currency_code = EXCLUDED.currency_code,
  measure = EXCLUDED.measure,
  curve_family = EXCLUDED.curve_family,
  instrument_type = EXCLUDED.instrument_type,
  tenor_years = EXCLUDED.tenor_years,
  tenor_label = EXCLUDED.tenor_label,
  unit = EXCLUDED.unit,
  frequency = EXCLUDED.frequency,
  quote_type = EXCLUDED.quote_type,
  source_id = EXCLUDED.source_id,
  methodology = EXCLUDED.methodology,
  is_derived = EXCLUDED.is_derived,
  metadata = EXCLUDED.metadata;

INSERT INTO market_data.observation (
  series_id, observed_on, observed_at, value, revision, quality_flag,
  source_document_url, ingestion_run_id, metadata
)
SELECT
  s.series_id, x.observed_on, x.observed_at, x.value, x.revision, x.quality_flag,
  x.source_document_url, r.ingestion_run_id, x.metadata
FROM observation_seed x
JOIN market_data.series s USING (series_key)
JOIN market_data.ingestion_run r
  ON r.run_key = 'interest-rate-bootstrap-2026-08-03'
ON CONFLICT (series_id, observed_on, revision) DO UPDATE SET
  observed_at = EXCLUDED.observed_at,
  value = EXCLUDED.value,
  quality_flag = EXCLUDED.quality_flag,
  source_document_url = EXCLUDED.source_document_url,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  metadata = EXCLUDED.metadata;

INSERT INTO market_data.observation_lineage
  (derived_observation_id, input_observation_id, relation, weight)
SELECT
  od.observation_id, oi.observation_id, x.relation, x.weight
FROM lineage_seed x
JOIN market_data.series sd ON sd.series_key = x.derived_series_key
JOIN market_data.observation od
  ON od.series_id = sd.series_id AND od.observed_on = x.derived_observed_on
JOIN market_data.series si ON si.series_key = x.input_series_key
JOIN market_data.observation oi
  ON oi.series_id = si.series_id AND oi.observed_on = x.input_observed_on
ON CONFLICT DO NOTHING;

COMMIT;
SQL
