import { BaseRepository } from "./base_repository.ts";

export type CanonicalEventInput = {
  eventId: string;
  eventTs: string;
  eventType: string;
  agentId?: string | null;
  operatorId?: string | null;
  experimentId?: string | null;
  parentEventId?: string | null;
  runId?: string | null;
  loopIteration?: number | null;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

export type CanonicalLogEnvelopeInput = {
  logId: string;
  schemaName: string;
  kind: string;
  asOfDate: string;
  generatedAt: string;
  producerComponent: string;
  producerVersion?: string | null;
  payload: Record<string, unknown>;
  derived?: boolean;
  lineage?: Record<string, unknown> | null;
};

export class EventRepository extends BaseRepository {
  public async appendEvent(input: CanonicalEventInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO obs.event
      (event_id, event_ts, event_type, agent_id, operator_id, experiment_id, parent_event_id,
       run_id, loop_iteration, payload_jsonb, metadata_jsonb)
      VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
      ON CONFLICT(event_id) DO UPDATE SET
        event_ts = EXCLUDED.event_ts,
        event_type = EXCLUDED.event_type,
        agent_id = EXCLUDED.agent_id,
        operator_id = EXCLUDED.operator_id,
        experiment_id = EXCLUDED.experiment_id,
        parent_event_id = EXCLUDED.parent_event_id,
        run_id = EXCLUDED.run_id,
        loop_iteration = EXCLUDED.loop_iteration,
        payload_jsonb = EXCLUDED.payload_jsonb,
        metadata_jsonb = EXCLUDED.metadata_jsonb
      `,
      [
        input.eventId,
        input.eventTs,
        input.eventType,
        input.agentId ?? null,
        input.operatorId ?? null,
        input.experimentId ?? null,
        input.parentEventId ?? null,
        input.runId ?? null,
        input.loopIteration ?? null,
        JSON.stringify(input.payload),
        JSON.stringify(input.metadata ?? null),
      ],
    );
  }

  public async appendLogEnvelope(
    input: CanonicalLogEnvelopeInput,
  ): Promise<void> {
    await this.db.query(
      `
      INSERT INTO obs.log_envelope
      (log_id, schema_name, kind, as_of_date, generated_at, producer_component, producer_version,
       payload_jsonb, derived, lineage_jsonb)
      VALUES ($1, $2, $3, $4::date, $5::timestamptz, $6, $7, $8::jsonb, $9, $10::jsonb)
      ON CONFLICT(log_id) DO UPDATE SET
        schema_name = EXCLUDED.schema_name,
        kind = EXCLUDED.kind,
        as_of_date = EXCLUDED.as_of_date,
        generated_at = EXCLUDED.generated_at,
        producer_component = EXCLUDED.producer_component,
        producer_version = EXCLUDED.producer_version,
        payload_jsonb = EXCLUDED.payload_jsonb,
        derived = EXCLUDED.derived,
        lineage_jsonb = EXCLUDED.lineage_jsonb
      `,
      [
        input.logId,
        input.schemaName,
        input.kind,
        input.asOfDate,
        input.generatedAt,
        input.producerComponent,
        input.producerVersion ?? null,
        JSON.stringify(input.payload),
        input.derived ?? false,
        JSON.stringify(input.lineage ?? null),
      ],
    );
  }
}
