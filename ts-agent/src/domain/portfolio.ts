import type { Ticker } from "./ticker";

export interface Position {
  ticker: Ticker;
  qty: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
}

export class PortfolioState {
  constructor(
    public cash: number,
    public readonly activePositions: Position[] = [],
  ) {}

  public get totalValuation(): number {
    // This would typically involve current market prices,
    // but as a pure model it represents the last known state.
    const positionsValue = this.activePositions.reduce(
      (sum, p) => sum + p.qty * p.entryPrice,
      0,
    );
    return this.cash + positionsValue;
  }
}
