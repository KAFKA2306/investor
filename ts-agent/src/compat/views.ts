import type { PostgresClient } from "../db/postgres_client.ts";

const compatViewStatements: readonly string[] = [
  `
  CREATE OR REPLACE VIEW compat.signals_v1 AS
  SELECT
    s.signal_id,
    i.symbol,
    TO_CHAR(s.trading_date, 'YYYY-MM-DD') AS date,
    s.risk_delta,
    s.pead_1d,
    s.pead_5d,
    s.combined_alpha,
    s.created_at
  FROM signal.signal s
  JOIN ref.instrument i ON i.instrument_id = s.instrument_id;
  `,
  `
  CREATE OR REPLACE VIEW compat.uqtl_events_v1 AS
  SELECT
    event_id AS id,
    event_ts AS timestamp,
    event_type AS type,
    agent_id,
    operator_id,
    experiment_id,
    parent_event_id,
    payload_jsonb::text AS payload,
    metadata_jsonb::text AS metadata
  FROM obs.event;
  `,
  `
  CREATE OR REPLACE VIEW compat.edinet_event_features_v1 AS
  SELECT
    ef.event_feature_id AS event_id,
    i.symbol,
    ef.filed_at,
    ef.source_doc_id AS doc_id,
    ef.risk_delta,
    ef.sentiment,
    ef.ai_exposure,
    ef.kg_centrality,
    ef.correction_flag,
    ef.correction_count_90d,
    ef.feature_version,
    ef.created_at
  FROM feature.event_feature ef
  JOIN ref.instrument i ON i.instrument_id = ef.instrument_id;
  `,
];

export async function ensureCompatViews(db: PostgresClient): Promise<void> {
  for (const sql of compatViewStatements) {
    await db.query(sql);
  }
}
