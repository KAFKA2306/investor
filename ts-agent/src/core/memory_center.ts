import { Database } from "bun:sqlite";
import { join } from "node:path";

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
  metrics_json: string; // ic_proxy, orthogonality, net_return, etc.
  overall_score: number;
}

/**
 * MemoryCenter replacing the old `logs/daily/YYYYMMDD.json` graveyard.
 * Stores experiments, generated DSLs, and their performance metrics logically.
 * Also holds the UQTL (Unified Quantum Task Ledger) for event sourcing.
 */
export class MemoryCenter {
  private db: Database;

  constructor(dbPath?: string) {
    const targetPath = dbPath || join(process.cwd(), "logs", "memory.sqlite");
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
    // biome-ignore lint/suspicious/noExplicitAny: Bun SQLite stmt.run binding
    (stmt.run as any)({
      $id:
        event.id ||
        `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      $ts: event.timestamp || new Date().toISOString(),
      $type: event.type,
      $agent: event.agentId || null,
      $exp: event.experimentId || null,
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
