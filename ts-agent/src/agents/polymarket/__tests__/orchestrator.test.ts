import { describe, expect, test, beforeEach } from "bun:test";
import { SwarmOrchestrator } from "../orchestrator";
import type { BacktestOutput } from "../../../schemas/polymarket_schemas";

describe("SwarmOrchestrator", () => {
  let orchestrator: SwarmOrchestrator;

  beforeEach(() => {
    orchestrator = new SwarmOrchestrator();
  });

  describe("initialization", () => {
    test("should initialize successfully", () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(SwarmOrchestrator);
    });
  });

  describe("runBacktest", () => {
    test("should return BacktestOutput with correct shape", async () => {
      const marketIds = ["0x123abc", "0x456def"];
      const window = "2026-03-03_2026-03-10";

      const output = await orchestrator.runBacktest(marketIds, window);

      expect(output).toBeDefined();
      expect(output.timestamp).toBeDefined();
      expect(typeof output.timestamp).toBe("string");
      expect(output.window).toBe(window);
      expect(Array.isArray(output.signals)).toBe(true);
      expect(output.metrics).toBeDefined();
      expect(output.metrics.totalExposure).toBeDefined();
      expect(output.metrics.maxDrawdown).toBeDefined();
      expect(output.metrics.sharpeRatio).toBeDefined();
      expect(output.metrics.winRate).toBeDefined();
      expect(output.learningUpdates).toBeDefined();
      expect(Array.isArray(output.learningUpdates.lessonsLearned)).toBe(true);
      expect(Array.isArray(output.learningUpdates.nextScanPriority)).toBe(true);
    });

    test("should return valid BacktestOutput with empty signals", async () => {
      const marketIds: string[] = [];
      const window = "2026-03-03_2026-03-10";

      const output = await orchestrator.runBacktest(marketIds, window);

      expect(output.signals).toHaveLength(0);
      expect(output.metrics.totalExposure).toBe(0);
    });

    test("should handle orchestration pipeline", async () => {
      const marketIds = ["0xtest123"];
      const window = "2026-03-03_2026-03-10";

      expect(async () => {
        await orchestrator.runBacktest(marketIds, window);
      }).not.toThrow();
    });
  });

  describe("error handling", () => {
    test("should gracefully handle empty market list", async () => {
      const output = await orchestrator.runBacktest(
        [],
        "2026-03-03_2026-03-10",
      );
      expect(output).toBeDefined();
      expect(output.signals).toHaveLength(0);
    });

    test("should handle invalid window format gracefully", async () => {
      const output = await orchestrator.runBacktest(
        ["0x123"],
        "invalid_window",
      );
      expect(output).toBeDefined();
      expect(output.window).toBe("invalid_window");
    });
  });
});
