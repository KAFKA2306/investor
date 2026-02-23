import { average, extractEstatValues } from "./analysis/daily_alpha.ts";
import { MarketdataLocalGateway } from "./gateways/marketdata_local_gateway.ts";

async function runTimeSeriesAnalysis() {
  const gateway = await MarketdataLocalGateway.create(["1375"]);
  const estatObj = (await gateway.getEstatStats("0000010101")) as Record<
    string,
    unknown
  >;
  const values = extractEstatValues(estatObj.GET_STATS_DATA);

  console.log("Time Series Analysis: Vegetable Prices (e-Stat 0000010101)");
  console.log("---------------------------------------------------------");
  console.log(`Total Data Points: ${values.length}`);

  if (values.length < 2) {
    console.log("Insufficient data points for time series analysis.");
    return;
  }

  // 1. Trend Analysis (Rolling Window)
  const windowSize = 3;
  console.log(`\nRolling Analysis (Window Size: ${windowSize}):`);
  console.log("| Index | Value | Rolling Avg | Momentum |");
  console.log("------------------------------------------");

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === undefined) continue;
    const window = values.slice(Math.max(0, i - windowSize + 1), i + 1);
    const rollingAvg = average(window);
    let momentum = "N/A";
    if (i > 0) {
      const prev = values[i - 1];
      if (prev !== undefined) {
        momentum =
          (((val - prev) / Math.max(Math.abs(prev), 1e-9)) * 100).toFixed(2) +
          "%";
      }
    }
    console.log(
      `| ${i.toString().padStart(5)} | ${val.toFixed(2).padStart(5)} | ${rollingAvg.toFixed(2).padStart(11)} | ${momentum.padStart(8)} |`,
    );
  }

  // 2. Volatility Analysis
  const returns = values.slice(1).map((v, i) => {
    const prev = values[i];
    if (v === undefined || prev === undefined || prev === 0) return 0;
    return (v - prev) / prev;
  });
  const avgReturn = average(returns);
  const variance = average(returns.map((r) => (r - avgReturn) ** 2));
  const stdDev = Math.sqrt(variance);

  console.log("\nSummary Statistics:");
  console.log(`- Average Value: ${average(values).toFixed(2)}`);
  console.log(`- Max Value: ${Math.max(...values).toFixed(2)}`);
  console.log(`- Min Value: ${Math.min(...values).toFixed(2)}`);
  console.log(`- Average Daily Return: ${(avgReturn * 100).toFixed(4)}%`);
  console.log(
    `- Volatility (Std Dev of Returns): ${(stdDev * 100).toFixed(4)}%`,
  );

  // 3. Forecast Accuracy (Backtesting Naive vs Rolling)
  console.log("\nBacktesting Forecast (Next Value Prediction):");
  let naiveErrorSum = 0;
  let rollingErrorSum = 0;
  const testCount = values.length - windowSize;

  for (let i = windowSize; i < values.length; i++) {
    const actual = values[i];
    const naiveForecast = values[i - 1];
    if (actual === undefined || naiveForecast === undefined) continue;
    const rollingForecast = average(values.slice(i - windowSize, i));

    naiveErrorSum += Math.abs(actual - naiveForecast);
    rollingErrorSum += Math.abs(actual - rollingForecast);
  }

  console.log(
    `- Naive Forecast (t-1) MAE: ${(naiveErrorSum / testCount).toFixed(4)}`,
  );
  console.log(
    `- Rolling Avg (${windowSize}) Forecast MAE: ${(rollingErrorSum / testCount).toFixed(4)}`,
  );

  if (rollingErrorSum < naiveErrorSum) {
    console.log(
      ">> Rolling Average outperforms Naive forecast for this sequence.",
    );
  } else {
    console.log(
      ">> Naive forecast (t-1) is more accurate or equal for this sequence.",
    );
  }
}

runTimeSeriesAnalysis();
