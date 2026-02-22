import { runParallel, writeDailyLog } from "./core.ts";

async function runDaily() {
  await runParallel(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  writeDailyLog({
    timestamp: new Date().toISOString(),
    result: "success",
    details: "Daily workflow executed",
  });
}

if (import.meta.main) {
  runDaily().catch((e) => {
    console.error("Error in daily workflow", e);
    process.exit(1);
  });
}
