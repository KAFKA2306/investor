import {
  DataPipelineRuntime,
  QuantResearchRuntime,
} from "../../system/data_pipeline_runtime.ts";

async function main() {
  const dataRuntime = new DataPipelineRuntime();
  const universe = dataRuntime.resolveUniverse([], 20);
  console.log(
    JSON.stringify(
      {
        proof: "dynamic_universe",
        count: universe.length,
        sample: universe.slice(0, 10),
      },
      null,
      2,
    ),
  );
  if (universe.length === 0) {
    throw new Error("universe unresolved");
  }

  const quantRuntime = new QuantResearchRuntime();
  console.log(
    JSON.stringify(
      {
        proof: "quant_manifest",
        manifest: quantRuntime.buildManifest(["1301", "1332"], "20220831", 0.8),
        window: quantRuntime.deriveVerificationWindow("20220831"),
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
