import { join } from "node:path";
import { z } from "zod";
import { core } from "../core/index.ts";
import { MarketdataDbCache } from "../data_cache/marketdata_db.ts";
import { SqliteHttpCache } from "../data_cache/sqlite_http_cache.ts";
import type { MarketDataGateway } from "./live_market_data_gateway.ts";

export class MarketdataLocalGateway implements MarketDataGateway {
  private readonly estatAppId = z
    .object({ ESTAT_APP_ID: z.string().min(1) })
    .parse(process.env).ESTAT_APP_ID;
  private readonly httpCache = new SqliteHttpCache(
    join(core.config.paths.logs, "cache", "market_cache.sqlite"),
  );
  private readonly db: MarketdataDbCache;

  private constructor(db: MarketdataDbCache) {
    this.db = db;
  }

  public static async create(
    symbols4: readonly string[],
  ): Promise<MarketdataLocalGateway> {
    const db = new MarketdataDbCache(
      "/mnt/d/marketdata",
      join(core.config.paths.logs, "cache", "marketdata.sqlite"),
    );
    await db.ensureLoaded(symbols4);
    return new MarketdataLocalGateway(db);
  }

  public async getEstatStats(
    statsDataId: string,
  ): Promise<Record<string, unknown>> {
    const url = new URL(
      "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData",
    );
    url.searchParams.set("appId", this.estatAppId);
    url.searchParams.set("statsDataId", statsDataId);
    url.searchParams.set("lang", "J");
    return this.httpCache.fetchJson(url.toString(), {}, 24 * 60 * 60 * 1000);
  }

  public async getListedInfo(): Promise<Record<string, unknown>[]> {
    return this.db.getListedInfo();
  }

  public async getDailyBars(
    symbol: string,
    dates: readonly string[],
  ): Promise<Record<string, unknown>[]> {
    return this.db.getLatestBar(symbol, dates);
  }

  public async getStatements(
    symbol: string,
  ): Promise<Record<string, unknown>[]> {
    return this.db.getLatestFin(symbol);
  }

  public async getMarketDataEndDate(): Promise<string> {
    const asof = await this.db.getLatestAsof("stock_price");
    return asof.replaceAll("-", "");
  }
}
