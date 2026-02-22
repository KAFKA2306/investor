import { core } from "../core/index.ts";

export class YFinanceProvider {
  constructor() {
    if (!core.config.providers.yfinance.enabled) {
      throw new Error("YFinance provider is disabled in config");
    }
  }

  public async getStockInfo(ticker: string): Promise<unknown> {
    // In a real implementation, we would use a fetch or a library
    // For this stub, we return a mock object
    return {
      ticker,
      status: "stub",
      message: "Actual integration via fetch/python-bridge required",
    };
  }
}

if (import.meta.main) {
  const provider = new YFinanceProvider();
  const info = await provider.getStockInfo("7203.T");
  console.log(info);
}
