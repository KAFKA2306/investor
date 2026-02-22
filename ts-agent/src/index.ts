import { runVegetableProof } from "./use_cases/run_vegetable_proof.ts";

async function runDaily() {
  const log = await runVegetableProof();
  console.log(JSON.stringify(log, null, 2));
}

if (import.meta.main) {
  runDaily().catch((e) => {
    console.error("Error in daily workflow", e);
    process.exit(1);
  });
}
