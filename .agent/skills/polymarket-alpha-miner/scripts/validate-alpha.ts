import { core } from "/home/kafka/finance/investor/ts-agent/src/system/app_runtime_core.ts";
import { PolymarketFetcher } from "/home/kafka/finance/investor/ts-agent/src/io/market/polymarket_fetcher.ts";
import { logger } from "/home/kafka/finance/investor/ts-agent/src/utils/logger.ts";

/**
 * Polymarket Alpha Validation Script
 * 
 * Quantitatively verifies the trading edge of a target wallet by analyzing
 * trading history directly from Polymarket's data API.
 */

async function validateAlpha(address: string, label: string) {
  const fetcher = new PolymarketFetcher();
  logger.info(`Starting Alpha Validation for: ${label} (${address})`);

  try {
    const txs = await fetcher.getUserTrades(address);
    if (!txs || txs.length === 0) {
      logger.error(`No transactions found for ${label}. Check API key or address.`);
      return;
    }

    // 1. Transaction Density Analysis (Frequency)
    // Polymarket returns timestamps in seconds usually, but we handle both cases just in case
    const timestamps = txs.map((tx: any) => tx.timestamp > 1e11 ? tx.timestamp / 1000 : tx.timestamp);
    const durationHours = (Math.max(...timestamps) - Math.min(...timestamps)) / 3600;
    const frequency = durationHours > 0 ? txs.length / durationHours : txs.length;

    // 2. Volume & Scale Analysis
    const totalVolume = txs.reduce((acc: number, tx: any) => acc + (tx.size * tx.price), 0);
    const avgTradeSize = totalVolume / txs.length;

    // 3. Alpha Identification (Simplified)
    let archetype = "Unknown";
    if (frequency > 10 && avgTradeSize < 1000) archetype = "Jim Simons Style (High Freq)";
    else if (avgTradeSize > 10000) archetype = "Information Arbitrage (High Conviction)";
    else if (frequency < 1) archetype = "Carry Trade / Patient Hunter";

    // 4. Output Results
    console.log(`\n--- ALPHA REPORT: ${label} ---`);
    console.log(`| Metric | Value |`);
    console.log(`| :--- | :--- |`);
    console.log(`| **Archetype** | ${archetype} |`);
    console.log(`| **Total Transactions (Sample)** | ${txs.length} |`);
    console.log(`| **Total Volume (USDC)** | $${totalVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} |`);
    console.log(`| **Avg Trade Size** | $${avgTradeSize.toFixed(2)} |`);
    console.log(`| **Trade Frequency** | ${frequency.toFixed(2)} tx/hr |`);
    console.log(`| **Sample Duration** | ${durationHours.toFixed(2)} hours |`);
    console.log(`-------------------------------\n`);

  } catch (error) {
    logger.error(`Validation failed: ${error}`);
  }
}

// Target execution
const targets = [
  { address: "0x019782cab5d844f02bafb71f512758be78579f3c", label: "majorexploiter" },
  { address: "0x2a2C53bD278c04DA9962Fcf96490E17F3DfB9Bc1", label: "0x2a2C..." }
];

(async () => {
  for (const target of targets) {
    await validateAlpha(target.address, target.label);
  }
})();
