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
      core.config.paths.data,
      join(core.config.paths.logs, "cache", "marketdata.sqlite"),
    );
    await db.ensureLoaded(symbols4);
    return new MarketdataLocalGateway(db);
  }

  public async getEstatStats(
    dataId: string,
  ): Promise<Record<string, number | string | boolean | null>> {
    const url = new URL(
      "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData",
    );
    url.searchParams.set("appId", this.estatAppId);
    url.searchParams.set("statsDataId", dataId);
    url.searchParams.set("lang", "J");
    const payload = await this.httpCache.fetchJson(
      url.toString(),
      {},
      24 * 60 * 60 * 1000,
    );
    return z
      .record(
        z.string(),
        z.union([z.number(), z.string(), z.boolean(), z.null()]),
      )
      .parse(payload);
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
    return fins.map((f) => f as Record<string, number>);
  }

  public async getMarketDataEndDate(): Promise<string> {
    const asof = await this.db.getLatestAsof("stock_price");
    return asof.replaceAll("-", "");
  }

  public async getHistory(symbol: string, limit: number): Promise<number[]> {
    const bars = this.db.getBars(symbol, limit);
    return bars.map((b) => Number(b.Close ?? 0));
  }

  public async getBars(
    symbol: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    return this.db.getBars(symbol, limit);
  }
}
