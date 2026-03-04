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

export class EvaluationRepository extends BaseRepository<{ id: string }> {
  protected readonly table = "eval.backtest_run";
  public async upsertBacktestRun(input: BacktestRunInput): Promise<void> {
    await this.executeUpsert({
      table: "eval.backtest_run",
      conflictTarget: "run_id",
      data: {
        run_id: input.runId,
        strategy_id: input.strategyId,
        from_date: input.fromDate,
        to_date: input.toDate,
        sharpe: input.sharpe,
        total_return: input.totalReturn,
        max_drawdown: input.maxDrawdown,
        config_json: this.toJson(input.configJson),
      },
      casts: {
        from_date: "date",
        to_date: "date",
        config_json: "jsonb",
      },
    });
  }

  public async upsertSignalOutcome(input: SignalOutcomeInput): Promise<void> {
    await this.executeUpsert({
      table: "eval.signal_outcome",
      conflictTarget: ["signal_id", "horizon"],
      data: {
        signal_id: input.signalId,
        horizon: input.horizon,
        realized_return: input.realizedReturn,
        benchmark_return: input.benchmarkReturn ?? null,
        measured_at: input.measuredAt ?? new Date().toISOString(),
      },
      casts: {
        measured_at: "timestamptz",
      },
    });
  }
}
