import { UnifiedLogSchema } from "./src/schemas/log.ts";
import { getTSModels } from "./src/model_registry/registry.ts";

const naiveMetrics = { mae: 1, rmse: 1, smape: 1, directionalAccuracy: 100 };
const resultsByModel: Record<string, { mae: number; rmse: number; smape: number; directionalAccuracy: number }> = { chronos: { mae: 1, rmse: 1, smape: 1, directionalAccuracy: 100 } };
const constants = { models: ["chronos"] };
const tsModels = await getTSModels();
const today = "20200101";
const startTime = Date.now();
const values = [1, 2, 3];

const benchmarkLog = {
    schema: "investor.benchmark-log.v1",
    generatedAt: new Date().toISOString(),
    models: tsModels.map(m => ({ id: m.id, vendor: m.vendor, name: m.name, context7LibraryId: m.context7LibraryId, github: m.github, arxiv: m.arxiv })),
    report: {
        type: "FOUNDATION_BENCHMARK",
        benchmarkId: `bench_${today}`,
        date: today,
        analyst: {
            baselines: [
                { name: "Naive", metrics: naiveMetrics },
                ...constants.models.map((id: string) => ({ name: id, metrics: resultsByModel[id] }))
            ],
            models: tsModels.map(m => ({ id: m.id, vendor: m.vendor, tags: m.tags })),
            recommendations: ["test"],
            insights: `test`
        },
        operator: { status: "PASS", dataset: "e-Stat", rowCount: 100, environment: "production", workflowReadiness: "PASS" },
        debugger: { telemetry: {}, envCheck: { python_venv: true, uv_installed: true }, rawValues: values, latencyMs: Date.now() - startTime }
    }
};

const result = UnifiedLogSchema.safeParse(benchmarkLog);
if (!result.success) {
    console.log(JSON.stringify(result.error.format(), null, 2));
} else {
    console.log("OK");
}
