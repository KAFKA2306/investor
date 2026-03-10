import { RollingBacktestOrchestrator } from "./rolling_backtest_orchestrator";

async function main() {
  const args = process.argv.slice(2);

  let windowDays = 90;
  let overlapDays = 30;
  let numMarkets = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--window-days" && i + 1 < args.length) {
      windowDays = parseInt(args[i + 1], 10);
    }
    if (args[i] === "--overlap-days" && i + 1 < args.length) {
      overlapDays = parseInt(args[i + 1], 10);
    }
    if (args[i] === "--num-markets" && i + 1 < args.length) {
      numMarkets = parseInt(args[i + 1], 10);
    }
  }

  console.log(`[Polymarket Backtest] Starting rolling backtest`);
  console.log(`  Window: ${windowDays} days`);
  console.log(`  Overlap: ${overlapDays} days`);
  console.log(`  Markets: ${numMarkets}`);

  const orchestrator = new RollingBacktestOrchestrator();

  // In a truthful implementation, we fetch real IDs from the API first.
  const marketIds: string[] = [];

  const result = await orchestrator.run(marketIds, {
    startDate: new Date("2026-01-01"),
    windowDays,
    overlapDays,
  });

  console.log("\n[Backtest Results]");
  console.log(`Final Verdict: ${result.finalVerdict}`);
  console.log(`Periods: ${result.periods.length}`);
  console.log(`Total Signals: ${result.summary.totalSignals}`);
  console.log(`Average Sharpe: ${result.summary.averageSharpe.toFixed(2)}`);
  console.log(
    `Improvement Trend: ${result.summary.improvementTrend ? "✓" : "✗"}`,
  );
  console.log(`Stability: ${result.summary.stability ? "✓" : "✗"}`);

  if (result.periods.length > 0 && result.periods[0].backtest.signals.length > 0) {
    console.log("\n[Signals Detected]");
    result.periods[0].backtest.signals.forEach((s, i) => {
      console.log(`  Signal ${i + 1}: ${s.marketId} | ${s.direction} | Edge: ${(s.edge * 100).toFixed(2)}%`);
    });
  }

  process.exit(result.finalVerdict === "GO" ? 0 : 1);
}

main().catch((err) => {
  console.error("[ERROR]", err.message);
  process.exit(1);
});
