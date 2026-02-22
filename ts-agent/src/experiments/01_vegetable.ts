export { runVegetableProof } from "../use_cases/run_vegetable_proof.ts";

import { runVegetableProof } from "../use_cases/run_vegetable_proof.ts";

const runAsMain = import.meta.main;
runAsMain &&
  runVegetableProof().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
