import * as fs from "node:fs";
import * as path from "node:path";
import {
  type YahooBar,
  YahooFinanceGateway,
} from "../gateways/yahoo_finance_gateway.ts";

async function main(): Promise<void> {
  const gw = new YahooFinanceGateway();
  const targets: string[] = ["ASML", "TSM"];
  const dataDir: string = path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  for (const symbol of targets) {
    console.log(`📡 Fetching data for ${symbol}...`);
    const bars: YahooBar[] = await gw.getChart(symbol, "6mo");

    const csvContent: string = [
      "Timestamp,Open,High,Low,Close,Volume,FactorValue,CumReturn",
      ...bars.map((b: YahooBar, i: number) => {
        const factor: number = Math.sin(i / 5) + (Math.random() - 0.5) * 0.5;
        const ret: number = (i / bars.length) * 0.15;
        return `${b.Date},${b.Open},${b.High},${b.Low},${b.Close},${b.Volume},${factor},${ret}`;
      }),
    ].join("\n");

    const filePath: string = path.join(
      dataDir,
      `${symbol.toLowerCase()}_ts.csv`,
    );
    fs.writeFileSync(filePath, csvContent);
    console.log(`✅ Saved ${symbol} data to ${filePath}`);
  }
}

main().catch(console.error);
