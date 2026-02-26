import { BaseAgent } from "../core/index.ts";
import { YahooFinanceGateway } from "../gateways/yahoo_finance_gateway.ts";

export interface VRPResult {
  symbol: string;
  iv: number;
  rv: number;
  spread: number;
  action: "SELL_PREMIUM" | "HOLD";
}

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

    const iv = 0.3;
    const spread = (iv - rv) * 100;

    return {
      symbol,
      iv,
      rv,
      spread,
      action: spread > 10 ? "SELL_PREMIUM" : "HOLD",
    };
  }
}
