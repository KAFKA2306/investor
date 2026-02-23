import { runFoundationBenchmark } from "../pipeline/evaluate/foundation_benchmark.ts";

export { runFoundationBenchmark };

if (import.meta.main) {
  runFoundationBenchmark().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
