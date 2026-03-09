import { PolymarketFetcher } from "../io/market/polymarket_fetcher.ts";

async function main() {
  const fetcher = new PolymarketFetcher();

  // An active Polymarket address, or read from arguments
  const targetAddress =
    process.argv[2] ?? "0x0000000000000000000000000000000000000000";
  console.log(
    `[VALIDATION] Fetching and validating data for: ${targetAddress}`,
  );

  console.log(`[VALIDATION] Attempting to fetch Trades...`);
  const trades = await fetcher.getUserTrades(targetAddress);
  console.log(
    `[VALIDATION] Trades verified against schema: ${trades.length} trades found.`,
  );

  console.log(`[VALIDATION] Attempting to fetch Positions...`);
  const positions = await fetcher.getUserPositions(targetAddress);
  console.log(
    `[VALIDATION] Positions verified against schema: ${positions.length} positions found.`,
  );

  console.log(`[VALIDATION] Attempting to fetch Events (Outcomes)...`);
  const events = await fetcher.getEvents(5);
  console.log(
    `[VALIDATION] Events verified against schema: ${events.length} events found.`,
  );

  console.log(`[VALIDATION] ✅ Success. Data matches Zod schemas strictly.`);
}

main(); // No try-catch around main! Let it crash!
