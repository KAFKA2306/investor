import type { Market, ScanResult } from "../../schemas/polymarket_schemas";
import { BaseAgent } from "../../system/app_runtime_core.ts";

export class ScanAgent extends BaseAgent {
  async run(): Promise<void> {
    console.log("ScanAgent: Ready to scan markets");
  }

  filterMarkets(markets: Market[]): ScanResult[] {
    return markets
      .filter((m) => {
        const liquidityOk = m.liquidity > 0.5;
        const spreadOk = m.spread < 0.05;
        const timeOk = m.timeToClose > 86400;
        return liquidityOk && spreadOk && timeOk;
      })
      .map((m) => ({
        marketId: m.id,
        liquidityScore: m.liquidity,
        spread: m.spread,
        timeRemaining: m.timeToClose,
        passedFilter: true,
      }));
  }
}
