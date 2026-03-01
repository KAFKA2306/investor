import { Database } from "bun:sqlite";
import type { PostgresClient } from "../postgres_client.ts";
import { DocumentRepository } from "../repos/document_repository.ts";
import { EventRepository } from "../repos/event_repository.ts";
import { FeatureRepository } from "../repos/feature_repository.ts";
import { SignalRepository } from "../repos/signal_repository.ts";

export type SqliteMigrationPaths = {
  knowledgebasePath: string;
  memoryPath: string;
};

async function ensureInstrument(
  db: PostgresClient,
  symbol: string,
): Promise<string> {
  const instrumentId = symbol;
  await db.query(
    `
    INSERT INTO ref.instrument (instrument_id, symbol, venue, status)
    VALUES ($1, $2, 'TSE', 'ACTIVE')
    ON CONFLICT(instrument_id) DO UPDATE SET symbol = EXCLUDED.symbol
    `,
    [instrumentId, symbol],
  );
  return instrumentId;
}

export async function migrateSqliteToCanonical(
  pg: PostgresClient,
  paths: SqliteMigrationPaths,
): Promise<{ migratedSignals: number; migratedEvents: number }> {
  const kb = new Database(paths.knowledgebasePath, { readonly: true });
  const memory = new Database(paths.memoryPath, { readonly: true });

  const documents = new DocumentRepository(pg);
  const features = new FeatureRepository(pg);
  const signals = new SignalRepository(pg);
  const events = new EventRepository(pg);

  let migratedSignals = 0;
  let migratedEvents = 0;

  try {
    const docRows = kb
      .query("SELECT doc_id, symbol, source, filed_at, title FROM documents")
      .all() as Array<{
      doc_id: string;
      symbol: string;
      source: string;
      filed_at: string;
      title: string;
    }>;

    for (const doc of docRows) {
      const instrumentId = await ensureInstrument(pg, doc.symbol);
      await pg.query(
        `
        INSERT INTO ingest.source_document (source_doc_id, provider, external_id, instrument_id, filed_at, title)
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6)
        ON CONFLICT(source_doc_id) DO UPDATE SET
          provider = EXCLUDED.provider,
          external_id = EXCLUDED.external_id,
          instrument_id = EXCLUDED.instrument_id,
          filed_at = EXCLUDED.filed_at,
          title = EXCLUDED.title
        `,
        [
          doc.doc_id,
          doc.source,
          doc.doc_id,
          instrumentId,
          doc.filed_at,
          doc.title,
        ],
      );

      await documents.upsertDocument({
        documentId: doc.doc_id,
        sourceDocId: doc.doc_id,
        instrumentId,
        docType: doc.source,
        filedAt: doc.filed_at,
        title: doc.title,
      });
    }

    const signalRows = kb
      .query(
        "SELECT signal_id, symbol, date, combined_alpha, risk_delta, pead_1d, pead_5d FROM signals",
      )
      .all() as Array<{
      signal_id: string;
      symbol: string;
      date: string;
      combined_alpha: number;
      risk_delta: number;
      pead_1d: number;
      pead_5d: number;
    }>;

    for (const row of signalRows) {
      const instrumentId = await ensureInstrument(pg, row.symbol);
      await signals.upsertSignal({
        signalId: row.signal_id,
        instrumentId,
        tradingDate: row.date,
        combinedAlpha: row.combined_alpha,
        riskDelta: row.risk_delta,
        pead1d: row.pead_1d,
        pead5d: row.pead_5d,
      });
      migratedSignals += 1;
    }

    const featureRows = kb
      .query(
        `
        SELECT event_id, symbol, filed_at, doc_id, risk_delta, sentiment,
               ai_exposure, kg_centrality, correction_flag, correction_count_90d,
               feature_version
        FROM edinet_event_features
      `,
      )
      .all() as Array<{
      event_id: string;
      symbol: string;
      filed_at: string;
      doc_id: string;
      risk_delta: number;
      sentiment: number;
      ai_exposure: number;
      kg_centrality: number;
      correction_flag: number;
      correction_count_90d: number;
      feature_version: string;
    }>;

    for (const row of featureRows) {
      const instrumentId = await ensureInstrument(pg, row.symbol);
      await features.upsertFeatureVersion({
        featureName: "edinet_event",
        version: row.feature_version,
        formula: "legacy_migrated",
      });
      await features.upsertEventFeature({
        eventFeatureId: row.event_id,
        sourceDocId: row.doc_id,
        instrumentId,
        filedAt: row.filed_at,
        featureName: "edinet_event",
        featureVersion: row.feature_version,
        riskDelta: row.risk_delta,
        sentiment: row.sentiment,
        aiExposure: row.ai_exposure,
        kgCentrality: row.kg_centrality,
        correctionFlag: row.correction_flag === 1,
        correctionCount90d: row.correction_count_90d,
      });
    }

    const eventRows = memory
      .query(
        "SELECT id, timestamp, type, agent_id, operator_id, experiment_id, parent_event_id, payload_json, metadata_json FROM uqtl_events",
      )
      .all() as Array<{
      id: string;
      timestamp: string;
      type: string;
      agent_id: string | null;
      operator_id: string | null;
      experiment_id: string | null;
      parent_event_id: string | null;
      payload_json: string;
      metadata_json: string | null;
    }>;

    for (const row of eventRows) {
      await events.appendEvent({
        eventId: row.id,
        eventTs: row.timestamp,
        eventType: row.type,
        agentId: row.agent_id,
        operatorId: row.operator_id,
        experimentId: row.experiment_id,
        parentEventId: row.parent_event_id,
        payload: JSON.parse(row.payload_json || "{}"),
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      });
      migratedEvents += 1;
    }
  } finally {
    kb.close();
    memory.close();
  }

  return { migratedSignals, migratedEvents };
}
