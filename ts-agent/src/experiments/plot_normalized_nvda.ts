import {
  type YahooBar,
  YahooFinanceGateway,
} from "../gateways/yahoo_finance_gateway.ts";

async function main() {
  const targetSymbol = "NVDA";
  const gw = new YahooFinanceGateway();
  const bars = await gw.getChart(targetSymbol, "6mo");

  if (bars.length === 0) return;

  const closes = bars.map((b: YahooBar) => Number(b.Close));
  const mean =
    closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
  const stdDev = Math.sqrt(
    closes.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) /
      closes.length,
  );
  const normalized = closes.map((c: number) => (c - mean) / stdDev);

  normalized.forEach((val: number, i: number) => {
    if (i % 3 === 0) {
      const date = String(bars[i]?.Date);
      const pos = Math.round(
        ((val - Math.min(...normalized)) /
          (Math.max(...normalized) - Math.min(...normalized))) *
          60,
      );
      console.log(`${date} | ${" ".repeat(pos)}●`);
    }
  });
}

main().catch(process.exit);
