import { YahooFinanceGateway } from "../gateways/yahoo_finance_gateway.ts";

async function main() {
  console.log("📈 NVDA Normalized Price Plotting (6-Month Horizon)");
  const targetSymbol = "NVDA";
  const gw = new YahooFinanceGateway();

  console.log(`Fetching 6-month chart data for ${targetSymbol}...`);
  const bars = await gw.getChart(targetSymbol, "6mo");

  if (bars.length === 0) {
    console.error("No data found for plotting.");
    return;
  }

  const closes = bars.map((b: Record<string, unknown>) => Number(b.Close));
  const mean =
    closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
  const stdDev = Math.sqrt(
    closes.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) /
      closes.length,
  );

  // Z-Score Normalization
  const normalized = closes.map((c: number) => (c - mean) / stdDev);

  console.log("\n📊 Shard Normalized Price Trend (Z-Score):");
  console.log("-------------------------------------------");

  const plotWidth = 60;
  const minNormal = Math.min(...normalized);
  const maxNormal = Math.max(...normalized);

  normalized.forEach((val: number, i: number) => {
    // Basic downsampling for console display (e.g., every 3rd bar)
    if (i % 3 === 0) {
      const date = String(bars[i]?.Date);
      const pos = Math.round(
        ((val - minNormal) / (maxNormal - minNormal)) * plotWidth,
      );
      const line = `${" ".repeat(pos)}●`;
      console.log(`${date} | ${line}`);
    }
  });

  console.log("-------------------------------------------");
  console.log(`Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}`);
  console.log("Normalization complete. Visual representation generated.");
}

main().catch(console.error);
