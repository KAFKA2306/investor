import type { Market } from "../../agents/polymarket/types.ts";

const POLYMARKET_API_BASE = "https://clob.polymarket.com";

interface RawMarket {
  id: string;
  title: string;
  prices?: { yes?: number; no?: number };
  pool?: { totalValue?: number };
  liquidity?: number;
  closingTime?: string;
}

interface ApiResponse {
  markets?: RawMarket[];
}

interface HistoryData {
  history?: Array<{ t: number; p: number }>;
}

export async function getMarkets(limit: number = 50): Promise<Market[]> {
  const response = await fetch(`${POLYMARKET_API_BASE}/markets?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status}`);
  }
  const data = (await response.json()) as ApiResponse;
  const markets = data.markets || data;
  return (markets as RawMarket[]).map((m) => ({
    id: m.id,
    title: m.title,
    prices: { yes: m.prices?.yes || 0.5, no: m.prices?.no || 0.5 },
    spread: (m.prices?.no || 0.5) - (m.prices?.yes || 0.5),
    liquidity: m.pool?.totalValue || m.liquidity || 0,
    timeToClose: Math.floor(
      (new Date(m.closingTime || Date.now()).getTime() - Date.now()) / 1000,
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
  const data = (await response.json()) as HistoryData;
  return data.history || [];
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
