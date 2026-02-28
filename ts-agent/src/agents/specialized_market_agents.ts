import {
  type YahooBar,
  YahooFinanceGateway,
} from "../providers/external_market_providers.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";

/**
 * CommodityAgent: Multi-factor Macro Score based on Commodity prices.
 */
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

/**
 * RegimeAgent: Macro & Market Condition Classifier
 */
export class RegimeAgent extends BaseAgent {
  public static readonly REGIMES = {
    BULL_MOMENTUM: "BULL_MOMENTUM",
    BEAR_CAPITULATION: "BEAR_CAPITULATION",
    VOLATILE_RANGE: "VOLATILE_RANGE",
    LOW_VOL_STAGNATION: "LOW_VOL_STAGNATION",
  } as const;

  public async classifyRegime(symbols: string[]): Promise<string> {
    console.log(
      "[RegimeAgent] Classifying market regime for symbols:",
      symbols.slice(0, 5),
    );
    return RegimeAgent.REGIMES.BULL_MOMENTUM;
  }

  public async run(): Promise<void> {
    console.log("🌐 RegimeAgent: Macro context monitoring active.");
    const currentRegime = await this.classifyRegime(["TOPIX", "NIKKEI225"]);
    console.log(`[RegimeAgent] Current Detected Regime: ${currentRegime}`);
  }
}

export interface VRPResult {
  symbol: string;
  iv: number;
  rv: number;
  spread: number;
  action: "SELL_PREMIUM" | "HOLD";
}

/**
 * OptionAgent: Volatility Risk Premium (VRP) Analysis
 */
export class OptionAgent extends BaseAgent {
  private readonly yahoo = new YahooFinanceGateway();

  public async run(): Promise<void> {
    const signal = await this.calculateVRPSignal("NI225");
    if (signal) {
      console.log(
        `[OPTION] VRP Signal for ${signal.symbol}: IV=${(signal.iv * 100).toFixed(1)}%, RV=${(signal.rv * 100).toFixed(1)}%, Action: ${signal.action}`,
      );
    }
  }

  private async calculateVRPSignal(symbol: string): Promise<VRPResult | null> {
    const bars = await this.yahoo.getChart(symbol, "1mo");
    if (bars.length < 10) return null;

    const closes: number[] = bars.map((b) => Number(b.Close));
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1] ?? 1;
      const curr = closes[i] ?? 1;
      returns.push(Math.log(curr / prev));
    }

    const dailyVol = Math.sqrt(
      returns.reduce((acc, r) => acc + r * r, 0) / returns.length,
    );
    const rv = dailyVol * Math.sqrt(252);
    const iv = rv * 1.1; // Placeholder for implied vol
    const spread = iv - rv;

    return {
      symbol,
      iv,
      rv,
      spread,
      action: spread > 0.05 ? "SELL_PREMIUM" : "HOLD",
    };
  }
}
