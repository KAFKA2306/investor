import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTSModels } from "../model_registry/model_registry_loader.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import {
  type DailyScenarioLog,
  UnifiedLogSchema,
} from "../schemas/financial_domain_schemas.ts";
import { CanonicalLogEnvelopeSchema } from "../schemas/system_event_schemas.ts";
import { core } from "../system/app_runtime_core.ts";
import { extractEstatValues } from "./analysis/daily_alpha_feature_calculations.ts";

/**
 * Model Forecast Comparison
 */
export async function compareForecastAndOutcome() {
  const logsDir = join(core.config.paths.logs, "unified");
  if (!existsSync(logsDir)) return;
  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  console.log("| Date     | Forecast (Alpha) | Outcome (Return) | Accuracy |");
  for (const file of files) {
    const content = readFileSync(join(logsDir, file), "utf8");
    const raw = JSON.parse(content);
    const envelope = CanonicalLogEnvelopeSchema.safeParse(raw);
    if (!envelope.success || envelope.data.kind !== "daily_decision") continue;

    const payload = UnifiedLogSchema.safeParse(envelope.data.payload);
    if (!payload.success || payload.data.schema !== "investor.daily-log.v1")
      continue;

    const report = payload.data.report as DailyScenarioLog;
    const date = envelope.data.asOfDate || report?.date;
    const forecast = Number(report?.results?.expectedEdge ?? 0);
    const outcome = Number(report?.results?.basketDailyReturn ?? 0);
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
