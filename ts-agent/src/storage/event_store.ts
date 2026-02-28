import { Database } from "bun:sqlite";
import { BaseEventSchema, type EventType, type UQTLEvent } from "./uqtl.ts";

/**
 * SQLite-based Event Store for the Infinity Architecture.
 * Provides the storage layer for UQTL (Unified Quantum Task Ledger).
 */
export class EventStore {
  private readonly db: Database;

  constructor(dbPath?: string) {
    const defaultPath = "uqtl.sqlite"; // Default for tests
    this.db = new Database(dbPath || defaultPath, { create: true });
    this.initialize();
  }

  private initialize() {
    this.db.run(`
            CREATE TABLE IF NOT EXISTS uqtl_events (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                type TEXT NOT NULL,
                agent_id TEXT,
                operator_id TEXT,
                experiment_id TEXT,
                parent_event_id TEXT,
                payload TEXT NOT NULL, -- JSON
                metadata TEXT           -- JSON
            )
        `);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_uqtl_timestamp ON uqtl_events(timestamp)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_uqtl_type ON uqtl_events(type)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_uqtl_parent ON uqtl_events(parent_event_id)`,
    );
  }

  public appendEvent(event: UQTLEvent): void {
    const validated = BaseEventSchema.parse(event);
    console.log(
      `[EventStore] Appending event: ${validated.type} (ID: ${validated.id.slice(0, 8)})`,
    );
    this.db.run(
      `INSERT INTO uqtl_events (id, timestamp, type, agent_id, operator_id, experiment_id, parent_event_id, payload, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.id,
        validated.timestamp,
        validated.type,
        validated.agentId || null,
        validated.operatorId || null,
        validated.experimentId || null,
        validated.parentEventId || null,
        JSON.stringify(validated.payload),
        validated.metadata ? JSON.stringify(validated.metadata) : null,
      ],
    );
  }

  public getEventsSince(timestamp: string): UQTLEvent[] {
    const rows = this.db
      .query(
        "SELECT * FROM uqtl_events WHERE timestamp >= ? ORDER BY timestamp ASC",
      )
      .all(timestamp) as {
      id: string;
      timestamp: string;
      type: string;
      agent_id: string | null;
      operator_id: string | null;
      experiment_id: string | null;
      parent_event_id: string | null;
      payload: string;
      metadata: string | null;
    }[];
    return rows.map(
      (row) =>
        ({
          id: row.id,
          timestamp: row.timestamp,
          type: row.type as EventType,
          agentId: row.agent_id || undefined,
          operatorId: row.operator_id || undefined,
          experimentId: row.experiment_id || undefined,
          parentEventId: row.parent_event_id || undefined,
          payload: JSON.parse(row.payload),
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }) as UQTLEvent,
    );
  }

  public close() {
    this.db.close();
  }
}

export const eventStore = new EventStore();
