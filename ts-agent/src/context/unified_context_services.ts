import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path, { join } from "node:path";
import {
  type AceBullet,
  type AcePlaybook,
  AcePlaybookSchema,
} from "../schemas/financial_domain_schemas.ts";
import {
  BaseEventSchema,
  type EventType,
  type UQTLEvent,
} from "../system/runtime_engine.ts";

/**
 * ContextPlaybook handles the persistence and management of ACE context bullets.
 */
export class ContextPlaybook {
  private playbook: AcePlaybook = { bullets: [] };
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath || path.join(process.cwd(), "data", "playbook.json");
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const json = JSON.parse(data);
      this.playbook = AcePlaybookSchema.parse(json);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") {
        this.playbook = { bullets: [] };
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(this.playbook, null, 2),
      "utf-8",
    );
  }

  addBullet(
    bullet: Omit<AceBullet, "id" | "helpful_count" | "harmful_count">,
  ): string {
    const id = `ctx-${Math.random().toString(36).substring(2, 10)}`;
    const newBullet: AceBullet = {
      ...bullet,
      id,
      helpful_count: 0,
      harmful_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.playbook.bullets.push(newBullet);
    return id;
  }

  getBullets(section?: AceBullet["section"]): AceBullet[] {
    if (!section) return this.playbook.bullets;
    return this.playbook.bullets.filter((b) => b.section === section);
  }

  async prune(harmfulThreshold: number = 3): Promise<number> {
    const originalCount = this.playbook.bullets.length;
    this.playbook.bullets = this.playbook.bullets.filter(
      (b) => b.harmful_count < harmfulThreshold,
    );
    await this.save();
    return originalCount - this.playbook.bullets.length;
  }

  getRankedBullets(section?: AceBullet["section"]): AceBullet[] {
    const filtered = this.getBullets(section);
    return filtered.sort((a, b) => b.helpful_count - a.helpful_count);
  }

  async deduplicate(): Promise<number> {
    const seen = new Set<string>();
    const originalCount = this.playbook.bullets.length;
    this.playbook.bullets = this.playbook.bullets.filter((b) => {
      if (seen.has(b.content)) return false;
      seen.add(b.content);
      return true;
    });
    return originalCount - this.playbook.bullets.length;
  }
}

export interface ExperimentRecord {
  id: string;
  name: string;
  scenario: string;
  context_prompt: string;
  started_at: string;
}

export interface AlphaRecord {
  id: string;
  experiment_id: string;
  ast_json: string;
  description: string;
  reasoning: string;
  created_at: string;
}

export interface EvaluationRecord {
  id: string;
  alpha_id: string;
  market_date: string;
  metrics_json: string;
  overall_score: number;
}

/**
 * MemoryCenter: Stores experiments, generated DSLs, and their performance metrics.
 */
export class MemoryCenter {
  private db: Database;

  constructor(dbPath?: string) {
    const cwd = process.cwd();
    const baseDir = /(^|[/])ts-agent$/.test(cwd) ? join(cwd, "..") : cwd;
    const targetPath = dbPath || join(baseDir, "logs", "memory.sqlite");
    this.db = new Database(targetPath, { create: true });
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scenario TEXT NOT NULL,
        context_prompt TEXT NOT NULL,
        started_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alphas (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL,
        ast_json TEXT NOT NULL,
        description TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(experiment_id) REFERENCES experiments(id)
      );

      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        alpha_id TEXT NOT NULL,
        market_date TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        overall_score REAL NOT NULL,
        FOREIGN KEY(alpha_id) REFERENCES alphas(id)
      );

      CREATE TABLE IF NOT EXISTS uqtl_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        agent_id TEXT,
        experiment_id TEXT,
        payload_json TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_alphas_experiment ON alphas(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_alpha ON evaluations(alpha_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(overall_score DESC);
      CREATE INDEX IF NOT EXISTS idx_uqtl_timestamp ON uqtl_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_uqtl_type ON uqtl_events(type);
    `);
  }

  public recordExperiment(exp: ExperimentRecord) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO experiments (id, name, scenario, context_prompt, started_at)
      VALUES ($id, $name, $scenario, $context_prompt, $started_at)
    `);
    stmt.run({
      $id: exp.id,
      $name: exp.name,
      $scenario: exp.scenario,
      $context_prompt: exp.context_prompt,
      $started_at: exp.started_at,
    });
  }

  public recordAlpha(alpha: AlphaRecord) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO alphas (id, experiment_id, ast_json, description, reasoning, created_at)
      VALUES ($id, $exp_id, $ast, $desc, $reasoning, $created_at)
    `);
    stmt.run({
      $id: alpha.id,
      $exp_id: alpha.experiment_id,
      $ast: alpha.ast_json,
      $desc: alpha.description,
      $reasoning: alpha.reasoning,
      $created_at: alpha.created_at,
    });
  }

  public recordEvaluation(evalRecord: EvaluationRecord) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO evaluations (id, alpha_id, market_date, metrics_json, overall_score)
      VALUES ($id, $alpha_id, $date, $metrics, $score)
    `);
    stmt.run({
      $id: evalRecord.id,
      $alpha_id: evalRecord.alpha_id,
      $date: evalRecord.market_date,
      $metrics: evalRecord.metrics_json,
      $score: evalRecord.overall_score,
    });
  }

  public pushEvent(event: Record<string, unknown>) {
    const stmt = this.db.prepare(`
      INSERT INTO uqtl_events (id, timestamp, type, agent_id, experiment_id, payload_json, metadata_json)
      VALUES ($id, $ts, $type, $agent, $exp, $payload, $meta)
    `);
    // biome-ignore lint/suspicious/noExplicitAny: Bun SQLite named parameters binding
    (stmt.run as any)({
      $id:
        event.id ||
        `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      $ts: (event.timestamp as string) || new Date().toISOString(),
      $type: event.type as string,
      $agent: (event.agentId as string) || null,
      $exp: (event.experimentId as string) || null,
      $payload: JSON.stringify(event.payload),
      $meta: event.metadata ? JSON.stringify(event.metadata) : null,
    });
  }

  public getRecentSuccesses(limit: number = 5): unknown[] {
    const stmt = this.db.prepare(`
      SELECT a.id, a.description, a.ast_json, e.overall_score, e.metrics_json
      FROM alphas a
      JOIN evaluations e ON a.id = e.alpha_id
      WHERE e.overall_score > 0.05
      ORDER BY e.overall_score DESC
      LIMIT $limit
    `);
    return stmt.all({ $limit: limit });
  }

  public getRecentFailures(limit: number = 5): unknown[] {
    const stmt = this.db.prepare(`
      SELECT a.id, a.description, a.ast_json, e.overall_score, e.metrics_json
      FROM alphas a
      JOIN evaluations e ON a.id = e.alpha_id
      WHERE e.overall_score < 0.01
      ORDER BY e.overall_score ASC
      LIMIT $limit
    `);
    return stmt.all({ $limit: limit });
  }

  public getEvents(limit: number = 50): unknown[] {
    const stmt = this.db.prepare(`
      SELECT * FROM uqtl_events
      ORDER BY timestamp DESC
      LIMIT $limit
    `);
    return stmt.all({ $limit: limit });
  }

  public close() {
    this.db.close();
  }
}

/**
 * EventStore: Storage layer for UQTL (Unified Quantum Task Ledger).
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
