export class YFinanceProvider {
  public async getStockInfo(
    ticker: string,
  ): Promise<Record<string, unknown> | undefined> {
    const data = (await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
    ).then((r) => r.json())) as {
      quoteResponse?: { result?: Record<string, unknown>[] };
    };
    return data.quoteResponse?.result?.[0];
  }
}
