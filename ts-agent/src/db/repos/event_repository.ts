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
    await this.executeUpsert({
      table: "obs.event",
      conflictTarget: "event_id",
      data: {
        event_id: input.eventId,
        event_ts: input.eventTs,
        event_type: input.eventType,
        agent_id: input.agentId ?? null,
        operator_id: input.operatorId ?? null,
        experiment_id: input.experimentId ?? null,
        parent_event_id: input.parentEventId ?? null,
        run_id: input.runId ?? null,
        loop_iteration: input.loopIteration ?? null,
        payload_jsonb: this.toJson(input.payload),
        metadata_jsonb: this.toJson(input.metadata ?? null),
      },
      casts: {
        event_ts: "timestamptz",
        payload_jsonb: "jsonb",
        metadata_jsonb: "jsonb",
      },
    });
  }

  public async appendLogEnvelope(
    input: CanonicalLogEnvelopeInput,
  ): Promise<void> {
    await this.executeUpsert({
      table: "obs.log_envelope",
      conflictTarget: "log_id",
      data: {
        log_id: input.logId,
        schema_name: input.schemaName,
        kind: input.kind,
        as_of_date: input.asOfDate,
        generated_at: input.generatedAt,
        producer_component: input.producerComponent,
        producer_version: input.producerVersion ?? null,
        payload_jsonb: this.toJson(input.payload),
        derived: input.derived ?? false,
        lineage_jsonb: this.toJson(input.lineage ?? null),
      },
      casts: {
        as_of_date: "date",
        generated_at: "timestamptz",
        payload_jsonb: "jsonb",
        lineage_jsonb: "jsonb",
      },
    });
  }
}
