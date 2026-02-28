import { join } from "node:path";
import { z } from "zod";
import { core } from "../system/core.ts";
import { EstatProvider } from "./estat.ts";
import { MarketdataDbCache } from "./marketdata_db.ts";
import type { MarketDataGateway } from "./live_market_data_gateway.ts";

export class MarketdataLocalGateway implements MarketDataGateway {
  private readonly estat = new EstatProvider();
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
    const payload = await this.estat.getStats(dataId);
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
