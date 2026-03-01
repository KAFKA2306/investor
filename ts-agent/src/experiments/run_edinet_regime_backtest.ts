import { runKbSignalBacktest } from "./run_kb_signal_backtest.ts";

function ensureWithGates(args: readonly string[]): string[] {
  return args.includes("--with-gates") ? [...args] : [...args, "--with-gates"];
}

if (import.meta.main) {
  const args = ensureWithGates(process.argv.slice(2));
  runKbSignalBacktest(args).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
