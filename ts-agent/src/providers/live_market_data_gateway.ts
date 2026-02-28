import { core } from "../core/index.ts";
import { PeadJquantsGateway } from "./pead_market_gateway.ts";

export interface MarketDataGateway {
  getDailyBars(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]>;
  getUpcomingEarnings(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]>;
  getStatements(symbol: string): Promise<Record<string, number>[]>;
  getHistory(symbol: string, limit: number): Promise<number[]>;
  getEstatStats(dataId: string): Promise<Record<string, unknown>>;
  getMarketDataEndDate(): Promise<string>;
}

interface YahooChartPayload {
  chart: {
    result: {
      timestamp: number[];
      indicators: {
        quote: {
          close: (number | null)[];
        }[];
      };
    }[];
  };
}

export class LiveMarketDataGateway implements MarketDataGateway {
  private readonly jquants = new PeadJquantsGateway();
  private readonly cache = core.cache;

  public async getDailyBars(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]> {
    const results = await Promise.all(
      dates.map(async (date) => {
        const quotes = await this.jquants.getDailyQuotes({
          code: symbol,
          from: date,
          to: date,
        });
        return (quotes[0] as unknown as Record<string, number>) ?? null;
      }),
    );
    return results.filter((r): r is Record<string, number> => r !== null);
  }

  public async getUpcomingEarnings(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]> {
    const results = await Promise.all(
      dates.map(async (date) => {
        const bars = await this.jquants.getEarningsCalendar({
          date,
        });
        const filtered = symbol
          ? bars.filter((b: any) => {
            const code = (b.Code || b.code) as string | undefined;
            if (!code) return false;
            return code.startsWith(symbol) || symbol.startsWith(code);
          })
          : bars;

        // If symbol filter provided but no match, we skip this date for that symbol
        if (symbol && filtered.length === 0) return null;

        return (filtered[0] as unknown as Record<string, number>) ?? (symbol ? null : (bars[0] as any));
      }),
    );
    return results.filter((r): r is Record<string, number> => r !== null);
  }

  public async getStatements(
    _symbol: string,
  ): Promise<Record<string, number>[]> {
    const raw = await this.jquants.getStatements({ code: _symbol });
    return raw.map((s) => s as unknown as Record<string, number>);
  }

  public async getEstatStats(dataId: string): Promise<Record<string, unknown>> {
    const url = new URL(
      "http://api.e-stat.go.jp/rest/3.0/app/json/getStatsData",
    );
    const appId = process.env.ESTAT_APP_ID;
    if (!appId) throw new Error("ESTAT_APP_ID is required");

    url.searchParams.append("appId", appId);
    url.searchParams.append("statsDataId", dataId);

    const payload = await this.cache.fetchJson(
      url.toString(),
      {},
      7 * 24 * 60 * 60 * 1000,
    );
    return payload as Record<string, unknown>;
  }

  public async getHistory(symbol: string, limit: number): Promise<number[]> {
    const url = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.T`,
    );
    url.searchParams.append("interval", "1d");
    url.searchParams.append("range", "2y");

    const payload = await this.cache.fetchJson(
      url.toString(),
      {},
      24 * 60 * 60 * 1000,
    );
    const result = (payload as unknown as YahooChartPayload).chart.result[0];
    if (!result) throw new Error("No chart result");
    const closes = (result.indicators.quote[0]?.close ?? []).filter(
      (v: number | null): v is number => v !== null,
    );
    return closes.slice(-limit);
  }

  public async getMarketDataEndDate(): Promise<string> {
    const today = new Date();
    const jstNow = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    return jstNow.toISOString().slice(0, 10).replaceAll("-", "");
  }
}
