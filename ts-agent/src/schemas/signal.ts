import type { Ticker } from "./ticker";

export type SignalType = "PEAD" | "SENTIMENT" | "TECHNICAL";
export type Recommendation = "BUY" | "SELL" | "HOLD";

export class Signal {
  constructor(
    public readonly ticker: Ticker,
    public readonly type: SignalType,
    public readonly score: number,
    public readonly recommendation: Recommendation,
    public readonly reasoning: string,
    public readonly createdAt: Date = new Date(),
  ) {}
}
