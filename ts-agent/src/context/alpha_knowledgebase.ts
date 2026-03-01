import { Database } from "bun:sqlite";
import { join } from "node:path";
import { core } from "../system/app_runtime_core.ts";

export type KnowledgeDocumentInput = {
  docId: string;
  symbol: string;
  source: "EDINET" | "JQUANTS" | "MANUAL" | "ALPHA_DISCOVERY";
  filedAt: string; // YYYY-MM-DD
  title: string;
};

export type KnowledgeSectionInput = {
  docId: string;
  sectionName: string;
  content: string;
  sentiment: number;
  riskTermCount: number;
  aiTermCount: number;
};

export type MarketDailyInput = {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  earningsFlag: boolean;
};

export type SignalInput = {
  signalId: string;
  symbol: string;
  date: string; // YYYY-MM-DD
  riskDelta: number;
  pead1d: number;
  pead5d: number;
  combinedAlpha: number;
};

export type FeatureVersionInput = {
  featureName: string;
  version: string;
  formula: string;
};

export type SignalLineageInput = {
  signalId: string;
  sourceDocId: string;
  sourceSection: string;
  modelVersion: string;
};

export type BacktestRunInput = {
  runId: string;
  strategyId: string;
  fromDate: string;
  toDate: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
};

export type SignalBacktestEvent = {
  signalId: string;
  symbol: string;
  date: string;
  combinedAlpha: number;
  riskDelta: number;
  pead1d: number;
  pead5d: number;
  nextReturn: number;
};

export class AlphaKnowledgebase {
  private readonly db: Database;

  constructor(dbPath?: string) {
    const targetPath =
      dbPath ??
      join(core.config.paths.logs, "cache", "alpha_knowledgebase.sqlite");
    this.db = new Database(targetPath, { create: true });
    this.initialize();
  }

  private initialize(): void {
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        doc_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        source TEXT NOT NULL,
        filed_at TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sections (
        section_id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        section_name TEXT NOT NULL,
        content TEXT NOT NULL,
        sentiment REAL NOT NULL,
        risk_term_count INTEGER NOT NULL,
        ai_term_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(doc_id, section_name),
        FOREIGN KEY(doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
        section_id UNINDEXED,
        doc_id UNINDEXED,
        section_name,
        content,
        tokenize='unicode61'
      );

      CREATE TABLE IF NOT EXISTS market_daily (
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        earnings_flag INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(symbol, date)
      );

      CREATE TABLE IF NOT EXISTS signals (
        signal_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        risk_delta REAL NOT NULL,
        pead_1d REAL NOT NULL,
        pead_5d REAL NOT NULL,
        combined_alpha REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(symbol, date)
      );

      CREATE TABLE IF NOT EXISTS backtest_runs (
        run_id TEXT PRIMARY KEY,
        strategy_id TEXT NOT NULL,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        sharpe REAL NOT NULL,
        total_return REAL NOT NULL,
        max_dd REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feature_versions (
        feature_name TEXT NOT NULL,
        version TEXT NOT NULL,
        formula TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(feature_name, version)
      );

      CREATE TABLE IF NOT EXISTS signal_lineage (
        signal_id TEXT NOT NULL,
        source_doc_id TEXT NOT NULL,
        source_section TEXT NOT NULL,
        model_version TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(signal_id, source_doc_id, source_section),
        FOREIGN KEY(signal_id) REFERENCES signals(signal_id) ON DELETE CASCADE,
        FOREIGN KEY(source_doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_documents_symbol_filed_at
        ON documents(symbol, filed_at);
      CREATE INDEX IF NOT EXISTS idx_sections_doc_section
        ON sections(doc_id, section_name);
      CREATE INDEX IF NOT EXISTS idx_market_daily_symbol_date
        ON market_daily(symbol, date);
      CREATE INDEX IF NOT EXISTS idx_signals_symbol_date
        ON signals(symbol, date);
      CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy
        ON backtest_runs(strategy_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_signal_lineage_doc
        ON signal_lineage(source_doc_id, source_section);
    `);
  }

  public upsertDocument(input: KnowledgeDocumentInput): void {
    this.db
      .query(`
        INSERT INTO documents (doc_id, symbol, source, filed_at, title)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(doc_id) DO UPDATE SET
          symbol = excluded.symbol,
          source = excluded.source,
          filed_at = excluded.filed_at,
          title = excluded.title
      `)
      .run(input.docId, input.symbol, input.source, input.filedAt, input.title);
  }

  public upsertSection(input: KnowledgeSectionInput): void {
    const sectionId = `${input.docId}:${input.sectionName}`;
    this.db.exec("BEGIN;");
    try {
      this.db
        .query(`
          INSERT INTO sections (
            section_id, doc_id, section_name, content, sentiment,
            risk_term_count, ai_term_count, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(doc_id, section_name) DO UPDATE SET
            content = excluded.content,
            sentiment = excluded.sentiment,
            risk_term_count = excluded.risk_term_count,
            ai_term_count = excluded.ai_term_count,
            updated_at = datetime('now')
        `)
        .run(
          sectionId,
          input.docId,
          input.sectionName,
          input.content,
          input.sentiment,
          input.riskTermCount,
          input.aiTermCount,
        );

      this.db
        .query("DELETE FROM sections_fts WHERE section_id = ?")
        .run(sectionId);
      this.db
        .query(`
          INSERT INTO sections_fts (section_id, doc_id, section_name, content)
          VALUES (?, ?, ?, ?)
        `)
        .run(sectionId, input.docId, input.sectionName, input.content);
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  public upsertMarketRows(rows: readonly MarketDailyInput[]): void {
    if (rows.length === 0) return;
    this.db.exec("BEGIN;");
    try {
      const stmt = this.db.query(`
        INSERT INTO market_daily (
          symbol, date, open, high, low, close, volume, earnings_flag
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol, date) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          volume = excluded.volume,
          earnings_flag = excluded.earnings_flag
      `);
      for (const row of rows) {
        stmt.run(
          row.symbol,
          row.date,
          row.open,
          row.high,
          row.low,
          row.close,
          row.volume,
          row.earningsFlag ? 1 : 0,
        );
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  public upsertSignals(rows: readonly SignalInput[]): void {
    if (rows.length === 0) return;
    this.db.exec("BEGIN;");
    try {
      const stmt = this.db.query(`
        INSERT INTO signals (
          signal_id, symbol, date, risk_delta, pead_1d, pead_5d, combined_alpha
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(signal_id) DO UPDATE SET
          symbol = excluded.symbol,
          date = excluded.date,
          risk_delta = excluded.risk_delta,
          pead_1d = excluded.pead_1d,
          pead_5d = excluded.pead_5d,
          combined_alpha = excluded.combined_alpha
      `);
      for (const row of rows) {
        stmt.run(
          row.signalId,
          row.symbol,
          row.date,
          row.riskDelta,
          row.pead1d,
          row.pead5d,
          row.combinedAlpha,
        );
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  public upsertFeatureVersion(input: FeatureVersionInput): void {
    this.db
      .query(`
        INSERT INTO feature_versions (feature_name, version, formula)
        VALUES (?, ?, ?)
        ON CONFLICT(feature_name, version) DO UPDATE SET
          formula = excluded.formula
      `)
      .run(input.featureName, input.version, input.formula);
  }

  public upsertSignalLineage(rows: readonly SignalLineageInput[]): void {
    if (rows.length === 0) return;
    this.db.exec("BEGIN;");
    try {
      const stmt = this.db.query(`
        INSERT INTO signal_lineage (
          signal_id, source_doc_id, source_section, model_version
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(signal_id, source_doc_id, source_section) DO UPDATE SET
          model_version = excluded.model_version
      `);
      for (const row of rows) {
        stmt.run(
          row.signalId,
          row.sourceDocId,
          row.sourceSection,
          row.modelVersion,
        );
      }
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  public recordBacktestRun(input: BacktestRunInput): void {
    this.db
      .query(`
        INSERT INTO backtest_runs (
          run_id, strategy_id, from_date, to_date, sharpe, total_return, max_dd
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          strategy_id = excluded.strategy_id,
          from_date = excluded.from_date,
          to_date = excluded.to_date,
          sharpe = excluded.sharpe,
          total_return = excluded.total_return,
          max_dd = excluded.max_dd
      `)
      .run(
        input.runId,
        input.strategyId,
        input.fromDate,
        input.toDate,
        input.sharpe,
        input.totalReturn,
        input.maxDrawdown,
      );
  }

  public searchSections(
    query: string,
    limit = 10,
  ): {
    docId: string;
    sectionName: string;
    rank: number;
  }[] {
    return this.db
      .query(`
        SELECT doc_id as docId, section_name as sectionName, bm25(sections_fts) as rank
        FROM sections_fts
        WHERE sections_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `)
      .all(query, Math.max(1, limit)) as {
      docId: string;
      sectionName: string;
      rank: number;
    }[];
  }

  public getCounts(): Record<string, number> {
    const countOf = (table: string): number => {
      const row = this.db
        .query(`SELECT COUNT(*) as count FROM ${table}`)
        .get() as { count: number } | null;
      return row?.count ?? 0;
    };
    return {
      documents: countOf("documents"),
      sections: countOf("sections"),
      market_daily: countOf("market_daily"),
      signals: countOf("signals"),
      backtest_runs: countOf("backtest_runs"),
      feature_versions: countOf("feature_versions"),
      signal_lineage: countOf("signal_lineage"),
    };
  }

  public fetchSignalBacktestEvents(
    fromDate?: string,
    toDate?: string,
    tradeLagDays = 1,
  ): SignalBacktestEvent[] {
    const lag = Math.max(1, Math.floor(tradeLagDays));
    const entryOffset = lag - 1;
    const exitOffset = lag;
    const rows = this.db
      .query(`
        SELECT
          s.signal_id AS signalId,
          s.symbol AS symbol,
          s.date AS date,
          s.combined_alpha AS combinedAlpha,
          s.risk_delta AS riskDelta,
          s.pead_1d AS pead1d,
          s.pead_5d AS pead5d,
          (
            (
              SELECT m_exit.close
              FROM market_daily m_exit
              WHERE m_exit.symbol = s.symbol AND m_exit.date > s.date
              ORDER BY m_exit.date ASC
              LIMIT 1 OFFSET ?
            ) / (
              SELECT m_entry.close
              FROM market_daily m_entry
              WHERE m_entry.symbol = s.symbol AND m_entry.date > s.date
              ORDER BY m_entry.date ASC
              LIMIT 1 OFFSET ?
            ) - 1
          ) AS nextReturn
        FROM signals s
        WHERE
          (? IS NULL OR s.date >= ?)
          AND (? IS NULL OR s.date <= ?)
        ORDER BY s.date ASC, s.symbol ASC
      `)
      .all(
        exitOffset,
        entryOffset,
        fromDate ?? null,
        fromDate ?? null,
        toDate ?? null,
        toDate ?? null,
      ) as {
      signalId: string;
      symbol: string;
      date: string;
      combinedAlpha: number | null;
      riskDelta: number | null;
      pead1d: number | null;
      pead5d: number | null;
      nextReturn: number | null;
    }[];

    return rows
      .map((row) => ({
        signalId: row.signalId,
        symbol: row.symbol,
        date: row.date,
        combinedAlpha: Number(row.combinedAlpha ?? 0),
        riskDelta: Number(row.riskDelta ?? 0),
        pead1d: Number(row.pead1d ?? 0),
        pead5d: Number(row.pead5d ?? 0),
        nextReturn: Number(row.nextReturn ?? Number.NaN),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.combinedAlpha) && Number.isFinite(row.nextReturn),
      );
  }

  public close(): void {
    this.db.close();
  }
}
