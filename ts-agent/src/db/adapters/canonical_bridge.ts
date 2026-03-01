import { core } from "../../system/app_runtime_core.ts";
import { bootstrapCanonicalDb } from "../bootstrap.ts";
import { EventRepository } from "../repos/event_repository.ts";

export async function mirrorEventToCanonical(event: {
  id: string;
  timestamp: string;
  type: string;
  agentId?: string;
  operatorId?: string;
  experimentId?: string;
  parentEventId?: string;
  runId?: string;
  loopIteration?: number;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const canonicalEnabled = core.config.database?.canonicalDb?.enabled ?? false;
  const dualWriteEnabled =
    core.config.database?.canonicalDb?.dualWriteEnabled ?? false;
  if (!canonicalEnabled || !dualWriteEnabled) return;

  const db = await bootstrapCanonicalDb();
  if (!db) return;

  const repo = new EventRepository(db);
  await repo.appendEvent({
    eventId: event.id,
    eventTs: event.timestamp,
    eventType: event.type,
    agentId: event.agentId,
    operatorId: event.operatorId,
    experimentId: event.experimentId,
    parentEventId: event.parentEventId,
    runId: event.runId,
    loopIteration: event.loopIteration,
    payload: event.payload,
    metadata: event.metadata,
  });
}
