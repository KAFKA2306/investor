import { MarketdataDbCache } from "../../providers/cache_providers.ts";
import {
  EstatProvider,
  PeadJquantsGateway,
  YahooFinanceGateway,
} from "../../providers/external_market_providers.ts";
import { core } from "../../system/app_runtime_core.ts";
import { paths } from "../../system/path_registry.ts";

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

abstract class BaseMarketDataGateway implements MarketDataGateway {
  private readonly estat = new EstatProvider();
  private readonly yahoo = new YahooFinanceGateway();
  protected readonly cache = core.cache;

  public async getEstatStats(dataId: string): Promise<Record<string, unknown>> {
    return await this.estat.getStats(dataId);
  }

  protected async fetchYahooHistory(
    symbol: string,
    limit: number,
  ): Promise<number[]> {
    const bars = await this.yahoo.getChart(symbol);
    return bars.slice(-limit).map((b) => b.close);
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
    return this.fetchYahooHistory(symbol, limit);
  }

  public async getMarketDataEndDate(): Promise<string> {
    const today = new Date();
    const jstNow = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    return jstNow.toISOString().slice(0, 10).replaceAll("-", "");
  }
}

export class MarketdataLocalGateway extends BaseMarketDataGateway {
  private readonly db: MarketdataDbCache;

  public constructor(db: MarketdataDbCache) {
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
    return fins.map((f: unknown) => f as Record<string, number>);
  }

  public async getMarketDataEndDate(): Promise<string> {
    const asof = await this.db.getLatestAsof("stock_price");
    return asof.replaceAll("-", "");
  }

  public async getHistory(symbol: string, limit: number): Promise<number[]> {
    return this.fetchYahooHistory(symbol, limit);
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
  private readonly estat = new EstatProvider();

  public async getJquantsListedInfo(): Promise<Record<string, unknown>[]> {
    return [] as Record<string, unknown>[];
  }

  public async getEstatStatsData(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    return await this.estat.getStats(statsDataId);
  }
}
