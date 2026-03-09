import { beforeEach, describe, expect, it } from "bun:test";
import type { Market } from "../../../schemas/polymarket_schemas";
import { ScanAgent } from "../scan_agent";

describe("ScanAgent", () => {
  let agent: ScanAgent;

  beforeEach(() => {
    agent = new ScanAgent();
  });

  describe("filterMarkets", () => {
    it("should filter markets by liquidity > 0.5", () => {
      const markets: Market[] = [
        {
          id: "m1",
          title: "Market 1",
          prices: { yes: 0.6, no: 0.4 },
          spread: 0.03,
          liquidity: 0.6,
          timeToClose: 100000,
        },
        {
          id: "m2",
          title: "Market 2",
          prices: { yes: 0.5, no: 0.5 },
          spread: 0.02,
          liquidity: 0.3,
          timeToClose: 100000,
        },
      ];

      const results = agent.filterMarkets(markets);
      expect(results).toHaveLength(1);
      expect(results[0].marketId).toBe("m1");
    });

    it("should filter markets by spread < 5%", () => {
      const markets: Market[] = [
        {
          id: "m1",
          title: "Market 1",
          prices: { yes: 0.6, no: 0.4 },
          spread: 0.03,
          liquidity: 0.6,
          timeToClose: 100000,
        },
        {
          id: "m2",
          title: "Market 2",
          prices: { yes: 0.3, no: 0.7 },
          spread: 0.1,
          liquidity: 0.6,
          timeToClose: 100000,
        },
      ];

      const results = agent.filterMarkets(markets);
      expect(results).toHaveLength(1);
      expect(results[0].marketId).toBe("m1");
    });

    it("should filter markets by timeToClose > 24 hours", () => {
      const markets: Market[] = [
        {
          id: "m1",
          title: "Market 1",
          prices: { yes: 0.6, no: 0.4 },
          spread: 0.03,
          liquidity: 0.6,
          timeToClose: 100000,
        },
        {
          id: "m2",
          title: "Market 2",
          prices: { yes: 0.5, no: 0.5 },
          spread: 0.03,
          liquidity: 0.6,
          timeToClose: 10000,
        },
      ];

      const results = agent.filterMarkets(markets);
      expect(results).toHaveLength(1);
      expect(results[0].marketId).toBe("m1");
    });

    it("should apply all 3 filters together", () => {
      const markets: Market[] = [
        {
          id: "m1",
          title: "Good Market",
          prices: { yes: 0.6, no: 0.4 },
          spread: 0.03,
          liquidity: 0.7,
          timeToClose: 100000,
        },
        {
          id: "m2",
          title: "Low Liquidity",
          prices: { yes: 0.5, no: 0.5 },
          spread: 0.03,
          liquidity: 0.2,
          timeToClose: 100000,
        },
        {
          id: "m3",
          title: "High Spread",
          prices: { yes: 0.3, no: 0.7 },
          spread: 0.1,
          liquidity: 0.6,
          timeToClose: 100000,
        },
        {
          id: "m4",
          title: "Closing Soon",
          prices: { yes: 0.5, no: 0.5 },
          spread: 0.03,
          liquidity: 0.6,
          timeToClose: 50000,
        },
      ];

      const results = agent.filterMarkets(markets);
      expect(results).toHaveLength(1);
      expect(results[0].marketId).toBe("m1");
    });

    it("should return empty array when no markets pass filters", () => {
      const markets: Market[] = [
        {
          id: "m1",
          title: "Market 1",
          prices: { yes: 0.5, no: 0.5 },
          spread: 0.1,
          liquidity: 0.2,
          timeToClose: 10000,
        },
      ];

      const results = agent.filterMarkets(markets);
      expect(results).toHaveLength(0);
    });

    it("should handle empty market list", () => {
      const results = agent.filterMarkets([]);
      expect(results).toHaveLength(0);
    });
  });
});
