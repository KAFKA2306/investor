import { BaseAgent } from "../system/core.ts";
import {
  type YahooBar,
  YahooFinanceGateway,
} from "../providers/yahoo_finance_gateway.ts";

export class CommodityAgent extends BaseAgent {
  private readonly yahoo = new YahooFinanceGateway();

  public async run(): Promise<void> {
    const score = await this.calculateMacroScore();
    console.log(`[COMMODITY] Multi-factor Macro Score: ${score.toFixed(2)}`);
  }

  private async calculateMacroScore(): Promise<number> {
    const [goldBars, copperBars, oilBars]: [
      YahooBar[],
      YahooBar[],
      YahooBar[],
    ] = await Promise.all([
      this.yahoo.getChart("GC=F", "5d"),
      this.yahoo.getChart("HG=F", "5d"),
      this.yahoo.getChart("CL=F", "5d"),
    ]);

    const getPrice = (bars: YahooBar[]): number =>
      Number(bars.at(-1)?.Close ?? 0);

    const gold = getPrice(goldBars);
    const copper = getPrice(copperBars);
    const oil = getPrice(oilBars);

    if (gold === 0 || copper === 0 || oil === 0) {
      console.warn(
        "[COMMODITY] Insufficient data for macro score calculation.",
      );
      return 0;
    }

    const gcRatio = gold / (copper * 100);
    const gcBench = 5.3;

    let score = 0;

    if (gcRatio < gcBench) score += 0.5;
    else score -= 0.5;

    if (oil > 85) score -= 0.2;

    return Math.max(-1, Math.min(1, score));
  }
}
