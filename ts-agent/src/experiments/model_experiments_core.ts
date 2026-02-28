import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTSModels } from "../model_registry/model_registry_loader.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import { core } from "../system/app_runtime_core.ts";
import { extractEstatValues } from "./analysis/daily_alpha_feature_calculations.ts";

/**
 * Model Forecast Comparison
 */
export async function compareForecastAndOutcome() {
  const logsDir = join(core.config.paths.logs, "daily");
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort();
  console.log("| Date     | Forecast (Alpha) | Outcome (Return) | Accuracy |");
  for (const file of files) {
    const content = readFileSync(join(logsDir, file), "utf8");
    const log = JSON.parse(content);
    const date = log.report.date;
    const forecast = log.report.results.expectedEdge;
    const outcome = log.report.results.basketDailyReturn;
    const ratio = forecast === 0 ? 0 : outcome / forecast;
    console.log(
      `| ${date} | ${forecast.toFixed(6)} | ${outcome.toFixed(6)} | ${(ratio * 100).toFixed(2)}% |`,
    );
  }
}

/**
 * Time Series Model Analysis
 */
export async function runTimeSeriesAnalysis() {
  const gateway = await MarketdataLocalGateway.create(["1375"]);
  const estatObj = (await gateway.getEstatStats("0000010101")) as {
    GET_STATS_DATA: unknown;
  };
  const values = extractEstatValues(estatObj?.GET_STATS_DATA);
  const tsModels = await getTSModels();
  console.log(
    `[TS Analysis] Points: ${values.length}, Models: ${tsModels.length}`,
  );
}

if (import.meta.main) {
  if (process.argv.includes("--ts")) {
    runTimeSeriesAnalysis();
  } else {
    compareForecastAndOutcome();
  }
}
