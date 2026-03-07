import { runKbSignalBacktest } from "../../experiments/run_kb_signal_backtest.ts";

if (import.meta.main) {
  runKbSignalBacktest(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
