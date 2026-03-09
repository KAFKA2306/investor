import { describe, expect, test } from "bun:test";
import {
  BacktestOutputSchema,
  MarketSchema,
  ScanResultSchema,
  SignalSchema,
} from "../../../schemas/polymarket_schemas.ts";

describe("Polymarket Schemas", () => {
  describe("MarketSchema", () => {
    test("validates a valid market object", () => {
      const validMarket = {
        id: "0x123abc",
        title: "Will Bitcoin exceed $100k by end of 2025?",
        prices: { yes: 0.65, no: 0.35 },
        spread: 0.3,
        liquidity: 50000,
        timeToClose: 86400,
      };

      expect(() => MarketSchema.parse(validMarket)).not.toThrow();
      const parsed = MarketSchema.parse(validMarket);
      expect(parsed.id).toBe("0x123abc");
      expect(parsed.prices.yes).toBe(0.65);
    });

    test("rejects market with invalid price range", () => {
      const invalidMarket = {
        id: "0x123abc",
        title: "Will Bitcoin exceed $100k by end of 2025?",
        prices: { yes: 1.5, no: 0.35 },
        spread: 0.3,
        liquidity: 50000,
        timeToClose: 86400,
      };

      expect(() => MarketSchema.parse(invalidMarket)).toThrow();
    });

    test("rejects market with missing required fields", () => {
      const incompleteMarket = {
        id: "0x123abc",
        title: "Will Bitcoin exceed $100k by end of 2025?",
        prices: { yes: 0.65, no: 0.35 },
      };

      expect(() => MarketSchema.parse(incompleteMarket)).toThrow();
    });
  });

  describe("ScanResultSchema", () => {
    test("validates a valid scan result", () => {
      const validScanResult = {
        marketId: "0x123abc",
        liquidityScore: 0.85,
        spread: 0.02,
        timeRemaining: 3600,
        passedFilter: true,
      };

      expect(() => ScanResultSchema.parse(validScanResult)).not.toThrow();
      const parsed = ScanResultSchema.parse(validScanResult);
      expect(parsed.passedFilter).toBe(true);
    });

    test("rejects scan result with negative liquidity score", () => {
      const invalidScanResult = {
        marketId: "0x123abc",
        liquidityScore: -0.5,
        spread: 0.02,
        timeRemaining: 3600,
        passedFilter: true,
      };

      expect(() => ScanResultSchema.parse(invalidScanResult)).toThrow();
    });
  });

  describe("SignalSchema", () => {
    test("validates a valid signal", () => {
      const validSignal = {
        marketId: "0x123abc",
        direction: "YES",
        betSize: 1000,
        edge: 0.08,
        confidence: "HIGH",
        reasoning: "Strong sentiment signal with high liquidity",
      };

      expect(() => SignalSchema.parse(validSignal)).not.toThrow();
      const parsed = SignalSchema.parse(validSignal);
      expect(parsed.direction).toBe("YES");
      expect(parsed.confidence).toBe("HIGH");
    });

    test("rejects signal with invalid direction", () => {
      const invalidSignal = {
        marketId: "0x123abc",
        direction: "MAYBE",
        betSize: 1000,
        edge: 0.08,
        confidence: "HIGH",
        reasoning: "Strong sentiment signal",
      };

      expect(() => SignalSchema.parse(invalidSignal)).toThrow();
    });

    test("rejects signal with invalid confidence level", () => {
      const invalidSignal = {
        marketId: "0x123abc",
        direction: "YES",
        betSize: 1000,
        edge: 0.08,
        confidence: "EXTREME",
        reasoning: "Strong sentiment signal",
      };

      expect(() => SignalSchema.parse(invalidSignal)).toThrow();
    });
  });

  describe("BacktestOutputSchema", () => {
    test("validates a valid backtest output", () => {
      const validBacktest = {
        timestamp: "2026-03-10T12:00:00Z",
        window: "2026-03-03_2026-03-10",
        signals: [
          {
            marketId: "0x123abc",
            direction: "YES",
            betSize: 1000,
            edge: 0.08,
            confidence: "HIGH",
            reasoning: "Strong signal",
          },
        ],
        metrics: {
          totalExposure: 5000,
          maxDrawdown: 0.05,
          sharpeRatio: 1.8,
          winRate: 0.55,
        },
        learningUpdates: {
          lessonsLearned: ["Higher liquidity markets show better edge"],
          nextScanPriority: ["Focus on stable asset pairs"],
        },
      };

      expect(() => BacktestOutputSchema.parse(validBacktest)).not.toThrow();
      const parsed = BacktestOutputSchema.parse(validBacktest);
      expect(parsed.signals).toHaveLength(1);
      expect(parsed.metrics.sharpeRatio).toBe(1.8);
    });

    test("rejects backtest output with invalid metrics", () => {
      const invalidBacktest = {
        timestamp: "2026-03-10T12:00:00Z",
        window: "2026-03-03_2026-03-10",
        signals: [],
        metrics: {
          totalExposure: 5000,
          maxDrawdown: 1.5,
          sharpeRatio: 1.8,
          winRate: 0.55,
        },
        learningUpdates: {
          lessonsLearned: [],
          nextScanPriority: [],
        },
      };

      expect(() => BacktestOutputSchema.parse(invalidBacktest)).toThrow();
    });

    test("accepts empty signals array", () => {
      const backtestNoSignals = {
        timestamp: "2026-03-10T12:00:00Z",
        window: "2026-03-03_2026-03-10",
        signals: [],
        metrics: {
          totalExposure: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          winRate: 0,
        },
        learningUpdates: {
          lessonsLearned: [],
          nextScanPriority: [],
        },
      };

      expect(() => BacktestOutputSchema.parse(backtestNoSignals)).not.toThrow();
    });
  });
});
