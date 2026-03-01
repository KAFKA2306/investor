import { z } from "zod";
import { core } from "../system/app_runtime_core.ts";
import { paths } from "../system/path_registry.ts";
import { MarketdataDbCache } from "./cache_providers.ts";
import {
  EstatProvider,
  JQuantsProvider,
  PeadJquantsGateway,
} from "./external_market_providers.ts";

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

abstract class BaseMarketDataGateway implements MarketDataGateway {
  private readonly estat = new EstatProvider();

  public async getEstatStats(dataId: string): Promise<Record<string, unknown>> {
    return z
      .record(
        z.string(),
        z.union([z.number(), z.string(), z.boolean(), z.null(), z.unknown()]),
      )
      .parse(await this.estat.getStats(dataId));
  }

  public abstract getDailyBars(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]>;

  public abstract getUpcomingEarnings(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]>;

  public abstract getStatements(
    symbol: string,
  ): Promise<Record<string, number>[]>;

  public abstract getHistory(symbol: string, limit: number): Promise<number[]>;

  public abstract getMarketDataEndDate(): Promise<string>;
}

export class LiveMarketDataGateway extends BaseMarketDataGateway {
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
        const bars = await this.jquants.getEarningsCalendar({ date });
        const filtered = symbol
          ? (bars as { code: string }[]).filter((b) => {
              const code = b.code;
              if (!code) return false;
              return code.startsWith(symbol) || symbol.startsWith(code);
            })
          : (bars as Record<string, unknown>[]);

        if (symbol && filtered.length === 0) return null;

        return (
          (filtered[0] as unknown as Record<string, number>) ??
          (symbol ? null : (bars[0] as unknown as Record<string, number>))
        );
      }),
    );
    return results.filter((r): r is Record<string, number> => r !== null);
  }

  public async getStatements(
    symbol: string,
  ): Promise<Record<string, number>[]> {
    const raw = await this.jquants.getStatements({ code: symbol });
    return (raw as Record<string, unknown>[]).map(
      (s) => s as unknown as Record<string, number>,
    );
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
    const result = (payload.payload as unknown as YahooChartPayload).chart
      .result[0];
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

export class MarketdataLocalGateway extends BaseMarketDataGateway {
  private readonly db: MarketdataDbCache;

  private constructor(db: MarketdataDbCache) {
    super();
    this.db = db;
  }

  public static async create(
    symbols4: readonly string[],
  ): Promise<MarketdataLocalGateway> {
    const db = new MarketdataDbCache(paths.dataRoot, paths.marketdataSqlite);
    await db.ensureLoaded(symbols4);
    return new MarketdataLocalGateway(db);
  }

  public async getListedInfo(): Promise<
    Record<string, number | string | boolean | null>[]
  > {
    const info = await this.db.getListedInfo();
    return info.map(
      (i) => i as Record<string, number | string | boolean | null>,
    );
  }

  public async getDailyBars(
    symbol: string,
    dates: string[],
  ): Promise<Record<string, number>[]> {
    const bars = await this.db.getLatestBar(symbol, dates);
    return bars.map((b) => b as Record<string, number>);
  }

  public async getStatements(
    symbol: string,
  ): Promise<Record<string, number>[]> {
    const fins = await this.db.getLatestFin(symbol);
    return fins.map(
      (f: Record<string, unknown>) => f as Record<string, number>,
    );
  }

  public async getMarketDataEndDate(): Promise<string> {
    const asof = await this.db.getLatestAsof("stock_price");
    return asof.replaceAll("-", "");
  }

  public async getHistory(symbol: string, limit: number): Promise<number[]> {
    const bars = this.db.getBars(symbol, limit);
    return bars.map((b: Record<string, unknown>) => Number(b.Close ?? 0));
  }

  public async getUpcomingEarnings(
    _symbol: string,
    _dates: string[],
  ): Promise<Record<string, number>[]> {
    return [];
  }

  public async getBars(
    symbol: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    return this.db.getBars(symbol, limit);
  }

  public async getBarsAll(symbol: string): Promise<Record<string, unknown>[]> {
    return this.db.getBarsAll(symbol);
  }
}

export class ApiVerifyGateway {
  private readonly jquants = new JQuantsProvider();
  private readonly estat = new EstatProvider();

  public async getJquantsListedInfo(): Promise<Record<string, unknown>[]> {
    return z
      .array(z.record(z.string(), z.unknown()))
      .catch([])
      .parse(await this.jquants.getListedInfo());
  }

  public async getEstatStatsData(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    return z
      .record(z.string(), z.unknown())
      .parse(await this.estat.getStats(statsDataId));
  }
}
