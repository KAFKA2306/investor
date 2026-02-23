import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function compareForecastAndOutcome() {
  const logsDir = join(process.cwd(), "../logs/daily");
  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

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
    const accuracy = `${((outcome / forecast) * 100).toFixed(2)}%`;

    console.log(
      `| ${date} | ${forecast.toFixed(6)}         | ${outcome.toFixed(6)}         | ${accuracy.padStart(8)} |`,
    );
  }
}

compareForecastAndOutcome();
