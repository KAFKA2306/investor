import { BaseRepository } from "./base_repository.ts";

export type BacktestRunInput = {
  runId: string;
  strategyId: string;
  fromDate: string;
  toDate: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  configJson?: Record<string, unknown>;
};

export type SignalOutcomeInput = {
  signalId: string;
  horizon: string;
  realizedReturn: number;
  benchmarkReturn?: number | null;
  measuredAt?: string;
};

export class EvaluationRepository extends BaseRepository {
  public async upsertBacktestRun(input: BacktestRunInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO eval.backtest_run
      (run_id, strategy_id, from_date, to_date, sharpe, total_return, max_drawdown, config_json)
      VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
      ON CONFLICT(run_id) DO UPDATE SET
        strategy_id = EXCLUDED.strategy_id,
        from_date = EXCLUDED.from_date,
        to_date = EXCLUDED.to_date,
        sharpe = EXCLUDED.sharpe,
        total_return = EXCLUDED.total_return,
        max_drawdown = EXCLUDED.max_drawdown,
        config_json = EXCLUDED.config_json
      `,
      [
        input.runId,
        input.strategyId,
        input.fromDate,
        input.toDate,
        input.sharpe,
        input.totalReturn,
        input.maxDrawdown,
        input.configJson ? JSON.stringify(input.configJson) : null,
      ],
    );
  }

  public async upsertSignalOutcome(input: SignalOutcomeInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO eval.signal_outcome
      (signal_id, horizon, realized_return, benchmark_return, measured_at)
      VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
      ON CONFLICT(signal_id, horizon) DO UPDATE SET
        realized_return = EXCLUDED.realized_return,
        benchmark_return = EXCLUDED.benchmark_return,
        measured_at = EXCLUDED.measured_at
      `,
      [
        input.signalId,
        input.horizon,
        input.realizedReturn,
        input.benchmarkReturn ?? null,
        input.measuredAt ?? null,
      ],
    );
  }
}
