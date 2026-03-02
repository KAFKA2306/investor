export type CanonicalSchemaStatement = {
  name: string;
  sql: string;
};

export const canonicalSchemaStatements: readonly CanonicalSchemaStatement[] = [
  {
    name: "create-schemas",
    sql: `
      CREATE SCHEMA IF NOT EXISTS ref;
      CREATE SCHEMA IF NOT EXISTS ingest;
      CREATE SCHEMA IF NOT EXISTS research;
      CREATE SCHEMA IF NOT EXISTS feature;
      CREATE SCHEMA IF NOT EXISTS signal;
      CREATE SCHEMA IF NOT EXISTS eval;
      CREATE SCHEMA IF NOT EXISTS exec;
      CREATE SCHEMA IF NOT EXISTS obs;
      CREATE SCHEMA IF NOT EXISTS compat;
    `,
  },
  {
    name: "ref.instrument",
    sql: `
      CREATE TABLE IF NOT EXISTS ref.instrument (
        instrument_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        venue TEXT,
        currency TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        valid_from DATE,
        valid_to DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(symbol, venue)
      );
    `,
  },
  {
    name: "ingest.market_daily",
    sql: `
      CREATE TABLE IF NOT EXISTS ingest.market_daily (
        instrument_id TEXT NOT NULL REFERENCES ref.instrument(instrument_id),
        trading_date DATE NOT NULL,
        source TEXT NOT NULL,
        open NUMERIC NOT NULL,
        high NUMERIC NOT NULL,
        low NUMERIC NOT NULL,
        close NUMERIC NOT NULL,
        volume NUMERIC NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (instrument_id, trading_date, source)
      );
      CREATE INDEX IF NOT EXISTS idx_market_daily_date ON ingest.market_daily(trading_date DESC);
    `,
  },
  {
    name: "ingest.source_document",
    sql: `
      CREATE TABLE IF NOT EXISTS ingest.source_document (
        source_doc_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        external_id TEXT,
        instrument_id TEXT REFERENCES ref.instrument(instrument_id),
        filed_at TIMESTAMPTZ,
        title TEXT,
        payload_uri TEXT,
        checksum TEXT,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_source_document_provider_external ON ingest.source_document(provider, external_id);
    `,
  },
  {
    name: "research.document",
    sql: `
      CREATE TABLE IF NOT EXISTS research.document (
        document_id TEXT PRIMARY KEY,
        source_doc_id TEXT NOT NULL REFERENCES ingest.source_document(source_doc_id),
        instrument_id TEXT REFERENCES ref.instrument(instrument_id),
        doc_type TEXT,
        filed_at TIMESTAMPTZ,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_document_instrument_filed ON research.document(instrument_id, filed_at DESC);
    `,
  },
  {
    name: "research.document_section",
    sql: `
      CREATE TABLE IF NOT EXISTS research.document_section (
        section_id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES research.document(document_id) ON DELETE CASCADE,
        section_name TEXT NOT NULL,
        content TEXT NOT NULL,
        sentiment DOUBLE PRECISION NOT NULL,
        risk_term_count INTEGER NOT NULL,
        ai_term_count INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(document_id, section_name)
      );
      CREATE INDEX IF NOT EXISTS idx_document_section_doc ON research.document_section(document_id);
    `,
  },
  {
    name: "feature.feature_version",
    sql: `
      CREATE TABLE IF NOT EXISTS feature.feature_version (
        feature_name TEXT NOT NULL,
        version TEXT NOT NULL,
        formula TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(feature_name, version)
      );
    `,
  },
  {
    name: "feature.event_feature",
    sql: `
      CREATE TABLE IF NOT EXISTS feature.event_feature (
        event_feature_id TEXT PRIMARY KEY,
        source_doc_id TEXT NOT NULL REFERENCES ingest.source_document(source_doc_id),
        instrument_id TEXT NOT NULL REFERENCES ref.instrument(instrument_id),
        filed_at TIMESTAMPTZ NOT NULL,
        feature_name TEXT NOT NULL,
        feature_version TEXT NOT NULL,
        risk_delta DOUBLE PRECISION NOT NULL,
        sentiment DOUBLE PRECISION NOT NULL,
        ai_exposure DOUBLE PRECISION NOT NULL,
        kg_centrality DOUBLE PRECISION NOT NULL,
        correction_flag BOOLEAN NOT NULL DEFAULT FALSE,
        correction_count_90d INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (feature_name, feature_version)
          REFERENCES feature.feature_version(feature_name, version)
      );
      CREATE INDEX IF NOT EXISTS idx_event_feature_symbol_date ON feature.event_feature(instrument_id, filed_at DESC);
    `,
  },
  {
    name: "feature.macro_regime_daily",
    sql: `
      CREATE TABLE IF NOT EXISTS feature.macro_regime_daily (
        trading_date DATE PRIMARY KEY,
        regime_id TEXT NOT NULL,
        inflation_z DOUBLE PRECISION NOT NULL,
        iip_z DOUBLE PRECISION NOT NULL,
        yield_slope_z DOUBLE PRECISION NOT NULL,
        risk_on_score DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "signal.signal",
    sql: `
      CREATE TABLE IF NOT EXISTS signal.signal (
        signal_id TEXT PRIMARY KEY,
        instrument_id TEXT NOT NULL REFERENCES ref.instrument(instrument_id),
        trading_date DATE NOT NULL,
        combined_alpha DOUBLE PRECISION NOT NULL,
        risk_delta DOUBLE PRECISION NOT NULL,
        pead_1d DOUBLE PRECISION NOT NULL,
        pead_5d DOUBLE PRECISION NOT NULL,
        model_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(instrument_id, trading_date)
      );
      CREATE INDEX IF NOT EXISTS idx_signal_instrument_date ON signal.signal(instrument_id, trading_date DESC);
    `,
  },
  {
    name: "signal.signal_lineage",
    sql: `
      CREATE TABLE IF NOT EXISTS signal.signal_lineage (
        signal_id TEXT NOT NULL REFERENCES signal.signal(signal_id) ON DELETE CASCADE,
        source_doc_id TEXT NOT NULL REFERENCES ingest.source_document(source_doc_id),
        section_id TEXT NOT NULL DEFAULT '',
        feature_name TEXT,
        feature_version TEXT,
        evidence_type TEXT NOT NULL DEFAULT 'DOCUMENT_SECTION',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(signal_id, source_doc_id, section_id)
      );
      CREATE INDEX IF NOT EXISTS idx_signal_lineage_doc ON signal.signal_lineage(source_doc_id);
    `,
  },
  {
    name: "feature.signal_gate_decision",
    sql: `
      CREATE TABLE IF NOT EXISTS feature.signal_gate_decision (
        signal_id TEXT NOT NULL REFERENCES signal.signal(signal_id) ON DELETE CASCADE,
        gate_name TEXT NOT NULL,
        trading_date DATE NOT NULL,
        passed BOOLEAN NOT NULL,
        threshold_text TEXT NOT NULL,
        actual_value DOUBLE PRECISION,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(signal_id, gate_name)
      );
      CREATE INDEX IF NOT EXISTS idx_signal_gate_date ON feature.signal_gate_decision(trading_date DESC);
    `,
  },
  {
    name: "eval.backtest_run",
    sql: `
      CREATE TABLE IF NOT EXISTS eval.backtest_run (
        run_id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        sharpe DOUBLE PRECISION NOT NULL,
        total_return DOUBLE PRECISION NOT NULL,
        max_drawdown DOUBLE PRECISION NOT NULL,
        config_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_backtest_strategy_created ON eval.backtest_run(strategy_id, created_at DESC);
    `,
  },
  {
    name: "eval.signal_outcome",
    sql: `
      CREATE TABLE IF NOT EXISTS eval.signal_outcome (
        signal_id TEXT NOT NULL REFERENCES signal.signal(signal_id) ON DELETE CASCADE,
        horizon TEXT NOT NULL,
        realized_return DOUBLE PRECISION NOT NULL,
        benchmark_return DOUBLE PRECISION,
        measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(signal_id, horizon)
      );
    `,
  },
  {
    name: "exec.order_plan",
    sql: `
      CREATE TABLE IF NOT EXISTS exec.order_plan (
        order_plan_id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES eval.backtest_run(run_id),
        signal_id TEXT REFERENCES signal.signal(signal_id),
        instrument_id TEXT NOT NULL REFERENCES ref.instrument(instrument_id),
        side TEXT NOT NULL,
        target_weight DOUBLE PRECISION NOT NULL,
        payload_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_order_plan_run ON exec.order_plan(run_id, created_at DESC);
    `,
  },
  {
    name: "exec.execution_fill",
    sql: `
      CREATE TABLE IF NOT EXISTS exec.execution_fill (
        fill_id TEXT PRIMARY KEY,
        order_plan_id TEXT NOT NULL REFERENCES exec.order_plan(order_plan_id) ON DELETE CASCADE,
        filled_qty DOUBLE PRECISION NOT NULL,
        fill_price DOUBLE PRECISION NOT NULL,
        slippage_bps DOUBLE PRECISION,
        venue_ts TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_execution_fill_order_plan ON exec.execution_fill(order_plan_id, created_at DESC);
    `,
  },
  {
    name: "obs.event",
    sql: `
      CREATE TABLE IF NOT EXISTS obs.event (
        event_id TEXT PRIMARY KEY,
        event_ts TIMESTAMPTZ NOT NULL,
        event_type TEXT NOT NULL,
        agent_id TEXT,
        operator_id TEXT,
        experiment_id TEXT,
        parent_event_id TEXT,
        run_id TEXT,
        loop_iteration INTEGER,
        payload_jsonb JSONB NOT NULL,
        metadata_jsonb JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_obs_event_ts ON obs.event(event_ts DESC);
      CREATE INDEX IF NOT EXISTS idx_obs_event_run ON obs.event(run_id, event_ts DESC);
      CREATE INDEX IF NOT EXISTS idx_obs_event_type ON obs.event(event_type);
    `,
  },
  {
    name: "obs.log_envelope",
    sql: `
      CREATE TABLE IF NOT EXISTS obs.log_envelope (
        log_id TEXT PRIMARY KEY,
        schema_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        as_of_date DATE NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL,
        producer_component TEXT NOT NULL,
        producer_version TEXT,
        payload_jsonb JSONB NOT NULL,
        derived BOOLEAN NOT NULL DEFAULT FALSE,
        lineage_jsonb JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_log_envelope_asof ON obs.log_envelope(as_of_date DESC, kind);
    `,
  },
];

export function getCanonicalSchemaSql(): string[] {
  return canonicalSchemaStatements.map((stmt) => stmt.sql);
}
