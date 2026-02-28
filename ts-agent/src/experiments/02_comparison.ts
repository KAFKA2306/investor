import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { core } from "../system/core.ts";
import { loadModelRegistry } from "../model_registry/registry.ts";

const ComparisonRowSchema = z.object({
  date: z.string().regex(/^\d{8}$/),
  forecast: z.number(),
  outcome: z.number(),
  accuracy: z.number(),
});

const ComparisonReportSchema = z.object({
  generatedAt: z.string().datetime(),
  rows: z.array(ComparisonRowSchema),
});

export type ComparisonReport = z.infer<typeof ComparisonReportSchema>;

export async function compareForecastAndOutcome(): Promise<ComparisonReport> {
  const logsDir = join(core.config.paths.logs, "daily");
  const registry = await loadModelRegistry();

  console.log("🚀 Model Strategy Catalog (Registered):");
  registry.models.forEach((m) => {
    console.log(`- [${m.id}] ${m.name} by ${m.vendor}`);
  });
  console.log("");

  const files = readdirSync(logsDir)
    .filter(
      (f) =>
        f.endsWith(".json") && f !== "manifest.json" && /^\d{8}\.json$/.test(f),
    )
    .sort();
  const rows: z.infer<typeof ComparisonRowSchema>[] = [];

  console.log(
    "Comparison: Forecast (Expected Edge) vs Outcome (Actual Return)",
  );
  console.log(
    "---------------------------------------------------------------",
  );
  console.log("| Date     | Forecast (Alpha) | Outcome (Return) | Accuracy |");
  console.log(
    "---------------------------------------------------------------",
  );

  for (const file of files) {
    const raw = readFileSync(join(logsDir, file), "utf8");
    const log = JSON.parse(raw);
    const date = log.report.date;
    const forecast = log.report.results.expectedEdge;
    const outcome = log.report.results.basketDailyReturn;
    const ratio = forecast === 0 ? 0 : outcome / forecast;
    const accuracyPct = ratio * 100;
    const accuracy = `${accuracyPct.toFixed(2)}%`;

    console.log(
      `| ${date} | ${forecast.toFixed(6)}         | ${outcome.toFixed(6)}         | ${accuracy.padStart(8)} |`,
    );
    rows.push({ date, forecast, outcome, accuracy: ratio });
  }

  return ComparisonReportSchema.parse({
    generatedAt: new Date().toISOString(),
    rows,
  });
}

if (import.meta.main) {
  compareForecastAndOutcome();
}
