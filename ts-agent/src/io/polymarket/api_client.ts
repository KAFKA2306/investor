import type { Market } from "../../schemas/polymarket_schemas.ts";

const POLYMARKET_API_BASE = "https://clob.polymarket.com";

export async function getMarkets(limit: number = 50): Promise<Market[]> {
  const response = await fetch(`${POLYMARKET_API_BASE}/markets?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status}`);
  }
  const data = await response.json();
  return data.markets.map((m: {
    id: string;
    title: string;
    prices: { yes: number; no: number };
    pool: { totalValue: number };
    closingTime: string
  }) => ({
    id: m.id,
    title: m.title,
    prices: { yes: m.prices.yes, no: m.prices.no },
    spread: m.prices.no - m.prices.yes,
    liquidity: m.pool.totalValue,
    timeToClose: Math.floor(
      (new Date(m.closingTime).getTime() - Date.now()) / 1000,
    ),
  }));
}

export async function getPriceHistory(
  marketId: string,
  startTs: number,
  endTs: number,
  interval: string = "1h",
): Promise<Array<{ t: number; p: number }>> {
  const response = await fetch(
    `${POLYMARKET_API_BASE}/prices-history?market=${marketId}&startTs=${startTs}&endTs=${endTs}&interval=${interval}`,
  );
  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status}`);
  }
  const data = await response.json();
  return data.history;
}

export async function getOrderbook(marketId: string) {
  const response = await fetch(
    `${POLYMARKET_API_BASE}/orderbook?marketId=${marketId}`,
  );
  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status}`);
  }
  return response.json();
}
