import { LiveMarketDataGateway } from "./src/gateways/live_market_data_gateway.ts";

async function diagnose() {
    const gateway = new LiveMarketDataGateway();
    const symbol = "1332";
    const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const dates = [today];

    console.log(`Checking daily bars for ${symbol} on ${today}...`);
    const bars = await gateway.getDailyBars(symbol, dates);
    console.log(`Result: ${JSON.stringify(bars, null, 2)}`);

    const endDate = await gateway.getMarketDataEndDate();
    console.log(`Market data end date: ${endDate}`);
}

diagnose().catch(console.error);
