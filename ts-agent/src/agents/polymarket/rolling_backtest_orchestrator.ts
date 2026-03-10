import type { BacktestOutput } from "../../schemas/polymarket_schemas";
import { SwarmOrchestrator } from "./orchestrator";

export interface RollingWindowConfig {
  startDate: Date;
  windowDays: number;
  overlapDays: number;
}

export interface PeriodResult {
  periodNumber: number;
  window: { start: Date; end: Date };
  backtest: BacktestOutput;
  metrics: {
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    signalsGenerated: number;
  };
  learnings: string[];
  appliedLearnings: string[];
  verdict: "GO" | "HOLD" | "PIVOT";
}

export interface RollingBacktestResult {
  periods: PeriodResult[];
  finalVerdict: "GO" | "HOLD" | "PIVOT";
  summary: {
    totalSignals: number;
    averageSharpe: number;
    improvementTrend: boolean;
    stability: boolean;
  };
}

export class RollingBacktestOrchestrator {
  private orchestrator: SwarmOrchestrator;

  constructor() {
    this.orchestrator = new SwarmOrchestrator();
  }

  async run(
    marketIds: string[],
    config: RollingWindowConfig,
  ): Promise<RollingBacktestResult> {
    const periods: PeriodResult[] = [];
    const cumulativeLearnings: string[] = [];

    const windows = this.generateWindows(config);

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const windowLabel = `${window.start.toISOString().split("T")[0]}_to_${window.end.toISOString().split("T")[0]}`;

      const backtest = await this.orchestrator.runBacktest(
        marketIds,
        windowLabel,
      );

      const metrics = this.calculateMetrics(backtest);

      const appliedLearnings = [...cumulativeLearnings];

      const newLearnings = backtest.learningUpdates.lessonsLearned;
      cumulativeLearnings.push(...newLearnings);

      const verdict = this.evaluateMetrics(metrics, i);

      periods.push({
        periodNumber: i + 1,
        window: { start: window.start, end: window.end },
        backtest,
        metrics,
        learnings: newLearnings,
        appliedLearnings,
        verdict,
      });
    }

    const finalVerdict = this.determineFinalVerdict(periods);
    const summary = this.generateSummary(periods);

    return {
      periods,
      finalVerdict,
      summary,
    };
  }

  private generateWindows(
    config: RollingWindowConfig,
  ): Array<{ start: Date; end: Date }> {
    const windows: Array<{ start: Date; end: Date }> = [];
    const windowMs = (config.windowDays - 1) * 24 * 60 * 60 * 1000;
    const stepMs =
      (config.windowDays - config.overlapDays) * 24 * 60 * 60 * 1000;

    let currentStart = new Date(config.startDate);

    for (let i = 0; i < 3; i++) {
      const end = new Date(currentStart.getTime() + windowMs);
      windows.push({
        start: new Date(currentStart),
        end: new Date(end),
      });
      currentStart = new Date(currentStart.getTime() + stepMs);
    }

    return windows;
  }

  private calculateMetrics(backtest: BacktestOutput): PeriodResult["metrics"] {
    return {
      sharpeRatio: backtest.metrics.sharpeRatio,
      winRate: backtest.metrics.winRate,
      maxDrawdown: backtest.metrics.maxDrawdown,
      signalsGenerated: backtest.signals.length,
    };
  }

  private evaluateMetrics(
    metrics: PeriodResult["metrics"],
    _periodIndex: number,
  ): "GO" | "HOLD" | "PIVOT" {
    const { sharpeRatio, winRate, maxDrawdown } = metrics;

    if (sharpeRatio >= 1.8 && winRate >= 0.55 && maxDrawdown <= 0.1) {
      return "GO";
    }

    if (sharpeRatio >= 1.5 || winRate >= 0.52) {
      return "HOLD";
    }

    return "PIVOT";
  }

  private determineFinalVerdict(
    periods: PeriodResult[],
  ): "GO" | "HOLD" | "PIVOT" {
    const verdicts = periods.map((p) => p.verdict);

    if (verdicts.filter((v) => v === "GO").length >= 2) {
      return "GO";
    }

    if (verdicts.filter((v) => v === "PIVOT").length >= 3) {
      return "PIVOT";
    }

    return "HOLD";
  }

  private generateSummary(
    periods: PeriodResult[],
  ): RollingBacktestResult["summary"] {
    const sharpes = periods.map((p) => p.metrics.sharpeRatio);
    const averageSharpe = sharpes.reduce((a, b) => a + b, 0) / sharpes.length;

    const improvementTrend =
      sharpes.length >= 2 && sharpes[sharpes.length - 1] > sharpes[0];

    const stability =
      sharpes.length >= 2 && Math.max(...sharpes) - Math.min(...sharpes) < 0.5;

    return {
      totalSignals: periods.reduce(
        (sum, p) => sum + p.metrics.signalsGenerated,
        0,
      ),
      averageSharpe,
      improvementTrend,
      stability,
    };
  }
}

export async function runRollingBacktest(
  marketIds: string[],
  config: RollingWindowConfig,
): Promise<RollingBacktestResult> {
  const orchestrator = new RollingBacktestOrchestrator();
  return orchestrator.run(marketIds, config);
}
