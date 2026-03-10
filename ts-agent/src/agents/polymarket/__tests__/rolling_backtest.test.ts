import { beforeEach, describe, expect, test } from "bun:test";
import type { RollingWindowConfig } from "../rolling_backtest_orchestrator";
import { RollingBacktestOrchestrator } from "../rolling_backtest_orchestrator";

describe("RollingBacktestOrchestrator", () => {
  let orchestrator: RollingBacktestOrchestrator;

  beforeEach(() => {
    orchestrator = new RollingBacktestOrchestrator();
  });

  describe("initialization", () => {
    test("should initialize successfully", () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(RollingBacktestOrchestrator);
    });
  });

  describe("run", () => {
    test("should run 3 rolling backtest periods with correct date windows", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1", "market2"], config);

      expect(result.periods).toHaveLength(3);

      expect(result.periods[0].window.start.toISOString().split("T")[0]).toBe(
        "2026-01-01",
      );
      expect(result.periods[0].window.end.toISOString().split("T")[0]).toBe(
        "2026-03-31",
      );

      expect(result.periods[1].window.start.toISOString().split("T")[0]).toBe(
        "2026-03-02",
      );
      expect(result.periods[1].window.end.toISOString().split("T")[0]).toBe(
        "2026-05-30",
      );

      expect(result.periods[2].window.start.toISOString().split("T")[0]).toBe(
        "2026-05-01",
      );
      expect(result.periods[2].window.end.toISOString().split("T")[0]).toBe(
        "2026-07-29",
      );
    });

    test("should apply learning from previous periods to next period", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      expect(result.periods[0].learnings).toBeDefined();
      expect(Array.isArray(result.periods[0].learnings)).toBe(true);

      expect(result.periods[1].appliedLearnings).toBeDefined();
      expect(Array.isArray(result.periods[1].appliedLearnings)).toBe(true);

      if (result.periods[0].learnings.length > 0) {
        expect(result.periods[1].appliedLearnings).toContain(
          result.periods[0].learnings[0],
        );
      }

      expect(result.periods[2].appliedLearnings).toBeDefined();
    });

    test("should calculate metrics for each period (Sharpe, WinRate, MaxDD)", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      for (const period of result.periods) {
        expect(period.metrics).toBeDefined();
        expect(typeof period.metrics.sharpeRatio).toBe("number");
        expect(typeof period.metrics.winRate).toBe("number");
        expect(typeof period.metrics.maxDrawdown).toBe("number");
        expect(typeof period.metrics.signalsGenerated).toBe("number");
      }
    });

    test("should assign verdict to each period", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      for (const period of result.periods) {
        expect(["GO", "HOLD", "PIVOT"]).toContain(period.verdict);
      }
    });

    test("should return final verdict based on period verdicts", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      expect(["GO", "HOLD", "PIVOT"]).toContain(result.finalVerdict);
    });

    test("should generate summary with statistics", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalSignals).toBe("number");
      expect(typeof result.summary.averageSharpe).toBe("number");
      expect(typeof result.summary.improvementTrend).toBe("boolean");
      expect(typeof result.summary.stability).toBe("boolean");
    });

    test("should handle single market correctly", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-02-01"),
        windowDays: 60,
        overlapDays: 20,
      };

      const result = await orchestrator.run(["market1"], config);

      expect(result.periods.length).toBeGreaterThan(0);
      expect(result.periods[0].window).toBeDefined();
    });

    test("should handle multiple markets correctly", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-15"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(
        ["market1", "market2", "market3"],
        config,
      );

      expect(result.periods.length).toBe(3);
    });
  });

  describe("period numbering", () => {
    test("should correctly number periods sequentially", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      for (let i = 0; i < result.periods.length; i++) {
        expect(result.periods[i].periodNumber).toBe(i + 1);
      }
    });
  });

  describe("learning accumulation", () => {
    test("should accumulate learnings across periods", async () => {
      const config: RollingWindowConfig = {
        startDate: new Date("2026-01-01"),
        windowDays: 90,
        overlapDays: 30,
      };

      const result = await orchestrator.run(["market1"], config);

      let totalLearnings = 0;
      for (let i = 0; i < result.periods.length; i++) {
        totalLearnings += result.periods[i].learnings.length;
        if (i > 0) {
          expect(
            result.periods[i].appliedLearnings.length,
          ).toBeGreaterThanOrEqual(
            result.periods[i - 1].appliedLearnings.length,
          );
        }
      }

      expect(totalLearnings).toBeGreaterThanOrEqual(0);
    });
  });
});
