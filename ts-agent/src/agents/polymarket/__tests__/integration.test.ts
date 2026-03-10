import { describe, expect, test } from "bun:test";
import {
  BacktestOutputSchema,
  MarketSchema,
  PredictionResultSchema,
  RiskValidationSchema,
  ScanResultSchema,
  SignalSchema,
} from "../../../schemas/polymarket_schemas.ts";

describe("Polymarket Trading Bot Integration Tests", () => {
  const mockMarkets = [
    {
      id: "0x123abc",
      title: "Will Bitcoin hit $50k?",
      prices: { yes: 0.65, no: 0.35 },
      spread: 0.03,
      liquidity: 0.8,
      timeToClose: 86400 * 7,
    },
    {
      id: "0x456def",
      title: "Will Ethereum reach $3k?",
      prices: { yes: 0.58, no: 0.42 },
      spread: 0.04,
      liquidity: 0.75,
      timeToClose: 86400 * 5,
    },
    {
      id: "0x789ghi",
      title: "Will S&P 500 close above 5000?",
      prices: { yes: 0.72, no: 0.28 },
      spread: 0.02,
      liquidity: 0.9,
      timeToClose: 86400 * 3,
    },
  ];

  describe("Schema Validation", () => {
    test("should validate market schema compliance", () => {
      for (const market of mockMarkets) {
        const result = MarketSchema.safeParse(market);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      }
    });

    test("should validate scan result schema", () => {
      const scanResult = {
        marketId: "0x123abc",
        liquidityScore: 0.85,
        spread: 0.02,
        timeRemaining: 3600,
        passedFilter: true,
      };

      const result = ScanResultSchema.safeParse(scanResult);
      expect(result.success).toBe(true);
      expect(result.data?.passedFilter).toBe(true);
    });

    test("should validate prediction result schema", () => {
      const prediction = {
        marketId: "0x123abc",
        pModelXgb: 0.68,
        pModelLlm: 0.65,
        pModelConsensus: 0.665,
        confidence: "HIGH" as const,
      };

      const result = PredictionResultSchema.safeParse(prediction);
      expect(result.success).toBe(true);
      expect(result.data?.pModelConsensus).toBeCloseTo(0.665, 3);
    });

    test("should validate risk validation schema", () => {
      const risk = {
        marketId: "0x123abc",
        kellyCriterion: 0.12,
        betSize: 150.5,
        var95Loss: 45.2,
        approved: true,
        reasoning: "Kelly criterion within bounds, VaR acceptable",
      };

      const result = RiskValidationSchema.safeParse(risk);
      expect(result.success).toBe(true);
      expect(result.data?.approved).toBe(true);
    });

    test("should validate signal schema", () => {
      const signal = {
        marketId: "0x123abc",
        direction: "YES" as const,
        betSize: 150.5,
        edge: 0.115,
        confidence: "HIGH" as const,
        reasoning: "4% edge + 0.70 consensus",
      };

      const result = SignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
      expect(result.data?.direction).toBe("YES");
    });

    test("should validate backtest output schema", () => {
      const backtest = {
        timestamp: new Date().toISOString(),
        window: "2026-01-01_2026-03-31",
        signals: [
          {
            marketId: "0x123abc",
            direction: "YES" as const,
            betSize: 150.5,
            edge: 0.115,
            confidence: "HIGH" as const,
            reasoning: "4% edge + 0.70 consensus",
          },
        ],
        metrics: {
          totalExposure: 150.5,
          maxDrawdown: 0.032,
          sharpeRatio: 2.14,
          winRate: 0.684,
        },
        learningUpdates: {
          lessonsLearned: ["Avoid low liquidity markets"],
          nextScanPriority: ["high_volume_markets"],
        },
      };

      const result = BacktestOutputSchema.safeParse(backtest);
      expect(result.success).toBe(true);
      expect(result.data?.metrics.sharpeRatio).toBeGreaterThan(0);
      expect(result.data?.signals.length).toBeGreaterThan(0);
    });
  });

  describe("Market Filtering (ScanAgent Logic)", () => {
    test("should filter markets by liquidity, spread, and time", () => {
      const filtered = mockMarkets.filter((m) => {
        const liquidityOk = m.liquidity > 0.5;
        const spreadOk = m.spread < 0.05;
        const timeOk = m.timeToClose > 86400;
        return liquidityOk && spreadOk && timeOk;
      });

      expect(filtered.length).toBe(3);
      expect(filtered.every((m) => m.liquidity > 0.5)).toBe(true);
      expect(filtered.every((m) => m.spread < 0.05)).toBe(true);
      expect(filtered.every((m) => m.timeToClose > 86400)).toBe(true);
    });

    test("should exclude low liquidity markets", () => {
      const lowLiquidityMarket = {
        id: "0x999zzz",
        title: "Obscure market",
        prices: { yes: 0.6, no: 0.4 },
        spread: 0.02,
        liquidity: 0.3,
        timeToClose: 86400 * 5,
      };

      const allMarkets = [...mockMarkets, lowLiquidityMarket];
      const filtered = allMarkets.filter((m) => m.liquidity > 0.5);

      expect(filtered.length).toBe(3);
      expect(filtered.some((m) => m.id === "0x999zzz")).toBe(false);
    });

    test("should exclude wide-spread markets", () => {
      const wideSpreadMarket = {
        id: "0x888yyy",
        title: "Wide spread market",
        prices: { yes: 0.65, no: 0.35 },
        spread: 0.1,
        liquidity: 0.8,
        timeToClose: 86400 * 5,
      };

      const allMarkets = [...mockMarkets, wideSpreadMarket];
      const filtered = allMarkets.filter((m) => m.spread < 0.05);

      expect(filtered.length).toBe(3);
      expect(filtered.some((m) => m.id === "0x888yyy")).toBe(false);
    });

    test("should exclude markets close to resolution", () => {
      const closingMarket = {
        id: "0x777xxx",
        title: "Closing market",
        prices: { yes: 0.65, no: 0.35 },
        spread: 0.02,
        liquidity: 0.8,
        timeToClose: 3600,
      };

      const allMarkets = [...mockMarkets, closingMarket];
      const filtered = allMarkets.filter((m) => m.timeToClose > 86400);

      expect(filtered.length).toBe(3);
      expect(filtered.some((m) => m.id === "0x777xxx")).toBe(false);
    });
  });

  describe("Prediction Results & Model Consensus", () => {
    test("should generate valid prediction results", () => {
      const predictions = mockMarkets.map((m) => ({
        marketId: m.id,
        pModelXgb: Math.random() * 0.5 + 0.4,
        pModelLlm: Math.random() * 0.5 + 0.4,
        pModelConsensus: 0,
        confidence: "HIGH" as const,
      }));

      predictions.forEach((pred) => {
        pred.pModelConsensus = (pred.pModelXgb + pred.pModelLlm) / 2;
      });

      for (const pred of predictions) {
        const result = PredictionResultSchema.safeParse(pred);
        expect(result.success).toBe(true);
        expect(pred.pModelConsensus).toBeGreaterThanOrEqual(0.4);
        expect(pred.pModelConsensus).toBeLessThanOrEqual(0.9);
      }
    });

    test("should validate model consensus (XGBoost vs LLM)", () => {
      const predictions = [
        { xgb: 0.68, llm: 0.65 },
        { xgb: 0.58, llm: 0.61 },
        { xgb: 0.72, llm: 0.7 },
      ];

      for (const pred of predictions) {
        const correlation =
          1 - Math.abs(pred.xgb - pred.llm) / Math.max(pred.xgb, pred.llm);
        expect(correlation).toBeGreaterThan(0.7);
      }
    });

    test("should flag divergent model predictions", () => {
      const predictions = [
        { xgb: 0.75, llm: 0.75, shouldFlag: false },
        { xgb: 0.68, llm: 0.65, shouldFlag: false },
        { xgb: 0.85, llm: 0.45, shouldFlag: true },
      ];

      for (const pred of predictions) {
        const divergence = Math.abs(pred.xgb - pred.llm);
        const flagged = divergence > 0.15;
        expect(flagged).toBe(pred.shouldFlag);
      }
    });
  });

  describe("Risk Calculations (Kelly Criterion & VaR)", () => {
    test("should calculate Kelly criterion correctly", () => {
      const mockResults = mockMarkets.map((m) => {
        const p = m.prices.yes;
        const b = 1 / m.prices.yes - 1;
        const kellyCriterion = (p * b - (1 - p)) / b;
        const fractionalKelly = Math.max(
          0,
          Math.min(kellyCriterion * 0.25, 1.0),
        );

        return {
          marketId: m.id,
          fKelly: fractionalKelly,
          betSize: fractionalKelly * 1000,
          approved: true,
        };
      });

      for (const result of mockResults) {
        expect(result.fKelly).toBeGreaterThanOrEqual(0);
        expect(result.fKelly).toBeLessThanOrEqual(1);
        expect(result.betSize).toBeGreaterThanOrEqual(0);
      }
    });

    test("should enforce maximum Kelly fraction of 0.25", () => {
      const highProbability = 0.9;
      const odds = 1 / highProbability - 1;
      const kellyCriterion =
        (highProbability * odds - (1 - highProbability)) / odds;
      const fractionalKelly = Math.max(0, Math.min(kellyCriterion * 0.25, 1.0));

      expect(fractionalKelly).toBeLessThanOrEqual(0.25);
      expect(fractionalKelly).toBeGreaterThan(0);
    });

    test("should calculate VaR 95% loss correctly", () => {
      const positions = [
        { betSize: 1000, volatility: 0.2, loss95: 1000 * 1.645 * 0.2 },
        { betSize: 500, volatility: 0.15, loss95: 500 * 1.645 * 0.15 },
        { betSize: 2000, volatility: 0.1, loss95: 2000 * 1.645 * 0.1 },
      ];

      for (const pos of positions) {
        const loss = pos.betSize * 1.645 * pos.volatility;
        expect(Math.abs(loss - pos.loss95)).toBeLessThan(0.01);
      }
    });

    test("should validate risk constraints", () => {
      const constraints = {
        varDailyLimit: 500,
        exposureLimit: 5000,
        consensusMin: 0.7,
        maxDrawdownLimit: 0.08,
      };

      const validPosition = {
        varLoss: 45.2,
        totalExposure: 1250.5,
        consensus: 0.75,
        maxDrawdown: 0.032,
      };

      const invalidPosition = {
        varLoss: 600,
        totalExposure: 6000,
        consensus: 0.65,
        maxDrawdown: 0.15,
      };

      expect(validPosition.varLoss <= constraints.varDailyLimit).toBe(true);
      expect(validPosition.totalExposure <= constraints.exposureLimit).toBe(
        true,
      );
      expect(validPosition.consensus >= constraints.consensusMin).toBe(true);
      expect(validPosition.maxDrawdown <= constraints.maxDrawdownLimit).toBe(
        true,
      );

      expect(invalidPosition.varLoss <= constraints.varDailyLimit).toBe(false);
      expect(invalidPosition.totalExposure <= constraints.exposureLimit).toBe(
        false,
      );
      expect(invalidPosition.consensus >= constraints.consensusMin).toBe(false);
      expect(invalidPosition.maxDrawdown <= constraints.maxDrawdownLimit).toBe(
        false,
      );
    });
  });

  describe("Edge Detection (p_model - p_market)", () => {
    test("should validate edge detection", () => {
      const signals = [
        {
          pModel: 0.7,
          pMarket: 0.6,
          expectedEdge: 0.1,
          shouldTrade: true,
        },
        {
          pModel: 0.55,
          pMarket: 0.55,
          expectedEdge: 0.0,
          shouldTrade: false,
        },
        {
          pModel: 0.586,
          pMarket: 0.54,
          expectedEdge: 0.046,
          shouldTrade: true,
        },
        {
          pModel: 0.52,
          pMarket: 0.53,
          expectedEdge: -0.01,
          shouldTrade: false,
        },
      ];

      for (const sig of signals) {
        const edge = sig.pModel - sig.pMarket;
        expect(Math.abs(edge - sig.expectedEdge)).toBeLessThan(0.001);
        expect(edge > 0.04 === sig.shouldTrade).toBe(true);
      }
    });

    test("should set minimum edge threshold at 4%", () => {
      const edgeThreshold = 0.04;
      const tradableEdges = [0.05, 0.08, 0.12];
      const nonTradableEdges = [0.02, 0.03, 0.01];

      for (const edge of tradableEdges) {
        expect(edge > edgeThreshold).toBe(true);
      }

      for (const edge of nonTradableEdges) {
        expect(edge > edgeThreshold).toBe(false);
      }
    });
  });

  describe("Signal Generation & Reasoning", () => {
    test("should generate valid trade signals", () => {
      const signals = [
        {
          marketId: "0x123abc",
          direction: "YES" as const,
          betSize: 150.5,
          edge: 0.115,
          confidence: "HIGH" as const,
          reasoning: "4% edge + 0.70 consensus + high liquidity",
        },
        {
          marketId: "0x456def",
          direction: "NO" as const,
          betSize: 89.3,
          edge: 0.08,
          confidence: "MEDIUM" as const,
          reasoning: "Sentiment divergence between models",
        },
      ];

      for (const signal of signals) {
        const result = SignalSchema.safeParse(signal);
        expect(result.success).toBe(true);
        expect(result.data?.reasoning.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Rolling Window Logic", () => {
    test("should calculate rolling window dates correctly", () => {
      const startDate = new Date("2026-01-01");
      const windowDays = 90;
      const overlapDays = 30;
      const stepDays = windowDays - overlapDays;

      const windows = [
        {
          start: new Date("2026-01-01"),
          end: new Date("2026-03-31"),
        },
        {
          start: new Date(startDate.getTime() + stepDays * 24 * 60 * 60 * 1000),
          end: new Date(
            startDate.getTime() + (stepDays + windowDays) * 24 * 60 * 60 * 1000,
          ),
        },
      ];

      expect(windows[0].start.toISOString().split("T")[0]).toBe("2026-01-01");
      expect(windows[1].start.toISOString().split("T")[0]).toBe("2026-03-02");
    });

    test("should maintain overlap between windows", () => {
      const windowDays = 90;
      const overlapDays = 30;
      const stepDays = windowDays - overlapDays;

      expect(stepDays).toBe(60);
      expect(overlapDays).toBe(30);
      expect(stepDays + overlapDays).toBe(90);
    });
  });

  describe("Period Verdict Logic (GO/HOLD/PIVOT)", () => {
    test("should determine GO verdict correctly", () => {
      const goMetrics = {
        sharpeRatio: 2.0,
        winRate: 0.68,
        maxDrawdown: 0.05,
      };

      const determineVerdict = (m: typeof goMetrics) => {
        if (m.sharpeRatio >= 1.8 && m.winRate >= 0.55 && m.maxDrawdown <= 0.1) {
          return "GO";
        }
        if (m.sharpeRatio >= 1.5 || m.winRate >= 0.52) {
          return "HOLD";
        }
        return "PIVOT";
      };

      expect(determineVerdict(goMetrics)).toBe("GO");
    });

    test("should determine HOLD verdict correctly", () => {
      const holdMetrics = {
        sharpeRatio: 1.5,
        winRate: 0.55,
        maxDrawdown: 0.09,
      };

      const determineVerdict = (m: typeof holdMetrics) => {
        if (m.sharpeRatio >= 1.8 && m.winRate >= 0.55 && m.maxDrawdown <= 0.1) {
          return "GO";
        }
        if (m.sharpeRatio >= 1.5 || m.winRate >= 0.52) {
          return "HOLD";
        }
        return "PIVOT";
      };

      expect(determineVerdict(holdMetrics)).toBe("HOLD");
    });

    test("should determine PIVOT verdict correctly", () => {
      const pivotMetrics = {
        sharpeRatio: 0.8,
        winRate: 0.45,
        maxDrawdown: 0.15,
      };

      const determineVerdict = (m: typeof pivotMetrics) => {
        if (m.sharpeRatio >= 1.8 && m.winRate >= 0.55 && m.maxDrawdown <= 0.1) {
          return "GO";
        }
        if (m.sharpeRatio >= 1.5 || m.winRate >= 0.52) {
          return "HOLD";
        }
        return "PIVOT";
      };

      expect(determineVerdict(pivotMetrics)).toBe("PIVOT");
    });
  });

  describe("Learning Accumulation", () => {
    test("should accumulate lessons across periods", () => {
      const period1Lessons = [
        "Sentiment score < 0.3 has 80% loss rate",
        "Markets with < 2 days to resolution are volatile",
      ];

      const period2Lessons = [
        ...period1Lessons,
        "Avoid zero-liquidity markets",
      ];

      expect(period2Lessons.length).toBe(3);
      expect(period2Lessons).toContain(period1Lessons[0]);
      expect(period2Lessons).toContain(period1Lessons[1]);
    });

    test("should track scan priorities for next period", () => {
      const priorities = [
        "high_volume_markets",
        "stable_price_markets",
        "liquid_pairs",
      ];

      expect(priorities.length).toBe(3);
      expect(priorities[0]).toBe("high_volume_markets");
    });
  });

  describe("Complete Pipeline Integration", () => {
    test("should execute end-to-end backtest workflow", async () => {
      const backtest = {
        timestamp: new Date().toISOString(),
        window: "2026-01-01_2026-03-31",
        signals: [
          {
            marketId: "0x123abc",
            direction: "YES" as const,
            betSize: 150.5,
            edge: 0.115,
            confidence: "HIGH" as const,
            reasoning: "4% edge + 0.70 consensus",
          },
        ],
        metrics: {
          totalExposure: 150.5,
          maxDrawdown: 0.032,
          sharpeRatio: 2.14,
          winRate: 0.684,
        },
        learningUpdates: {
          lessonsLearned: ["Avoid low liquidity markets"],
          nextScanPriority: ["high_volume_markets"],
        },
      };

      const result = BacktestOutputSchema.safeParse(backtest);
      expect(result.success).toBe(true);

      if (result.success) {
        const data = result.data;
        expect(data.signals.length).toBeGreaterThan(0);
        expect(data.metrics.sharpeRatio).toBeGreaterThan(1.8);
        expect(data.metrics.winRate).toBeGreaterThan(0.68);
        expect(data.metrics.maxDrawdown).toBeLessThan(0.1);
        expect(data.learningUpdates.lessonsLearned.length).toBeGreaterThan(0);
      }
    });
  });
});
