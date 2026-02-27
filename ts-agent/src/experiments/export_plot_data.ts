import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { core } from "../core/index.ts";
import { UnifiedLogSchema } from "../schemas/log.ts";

function exportPlotData(logsBaseDir: string) {
  const logsDir = resolve(logsBaseDir, "daily");
  const files = readdirSync(logsDir)
    .filter((f) => /^\d{8}\.json$/.test(f))
    .sort();

  const rows: string[] = [
    "Timestamp,CumReturn,Drawdown,FactorValue,Volatility,AssetPrice,Position",
  ];
  let cumReturn = 0;
  let runningMax = 0;

  for (const file of files) {
    const raw = readFileSync(join(logsDir, file), "utf8");
    const logRaw = JSON.parse(raw);
    const result = UnifiedLogSchema.safeParse(logRaw);
    if (!result.success) continue;

    const log = result.data;
    const report = log.report as {
      date?: string;
      results?: { basketDailyReturn?: number };
    };
    if (!report || !report.results) continue;

    const date = report.date;
    const dailyReturn = report.results.basketDailyReturn || 0;

    cumReturn += dailyReturn;
    runningMax = Math.max(runningMax, cumReturn);
    const drawdown = cumReturn - runningMax;

    // Use dummy or representative values for other metrics if not in log
    const factorValue = 0.5; // Placeholder
    const volatility = 0.01; // Placeholder
    const assetPrice = 100 * (1 + cumReturn);
    const position = 1.0;

    rows.push(
      `${date},${cumReturn},${drawdown},${factorValue},${volatility},${assetPrice},${position}`,
    );
  }

  const outputPath = join(logsBaseDir, "alpha_performance.csv");
  writeFileSync(outputPath, rows.join("\n"));
  console.log(`✅ Exported plot data to: ${outputPath}`);
  return outputPath;
}

if (import.meta.main) {
  exportPlotData(core.config.paths.logs);
}
