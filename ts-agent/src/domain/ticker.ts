export class Ticker {
  constructor(
    public readonly symbol: string,
    public readonly name: string,
    public readonly sector: string,
  ) {}

  public toString(): string {
    return `[${this.symbol}] ${this.name} (${this.sector})`;
  }
}
