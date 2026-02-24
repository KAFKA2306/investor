import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AceAcquirer, AceEvaluator, AceEvolver } from "../agents/ace_agents.ts";
import { core } from "../core/index.ts";
import { ContextPlaybook } from "../core/playbook.ts";
import { executePaperOrders } from "../execution/paper_executor.ts";
import { runVegetableScenario } from "../experiments/scenarios/vegetable_daily.ts";
import { LiveMarketDataGateway } from "../gateways/live_market_data_gateway.ts";
import {
  loadForecastModelReferences,
  type ModelReference,
} from "../model_registry/registry.ts";
import { runLlmAgentReadiness } from "../pipeline/evaluate/llm_agent_readiness.ts";
import { type UnifiedLog, UnifiedLogSchema } from "../schemas/log.ts";

const yyyymmdd = (d: Date): string =>
  d.toISOString().slice(0, 10).replaceAll("-", "");

const lastCalendarDays = (days: number, anchor: Date): string[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    return yyyymmdd(d);
  });

const toModelRows = (models: readonly ModelReference[]) =>
  models.map((model) => ({
    id: model.id,
    vendor: model.vendor,
    name: model.name,
    context7LibraryId: model.context7LibraryId,
    github: model.github,
    arxiv: model.arxiv,
  }));

export async function runVegetableProof(): Promise<UnifiedLog> {
  const nowIso = new Date().toISOString();
  const gateway = new LiveMarketDataGateway();
  const marketDataEnd = await gateway.getMarketDataEndDate();
  const anchor = new Date(
    `${marketDataEnd.slice(0, 4)}-${marketDataEnd.slice(4, 6)}-${marketDataEnd.slice(6, 8)}T00:00:00.000Z`,
  );
  const playbook = new ContextPlaybook();
  await playbook.load();
  const playbookBullets = playbook.getRankedBullets();

  const report = await runVegetableScenario(
    gateway,
    nowIso,
    lastCalendarDays(20, anchor),
    playbookBullets,
  );
  const execution = executePaperOrders(report, nowIso);
  const reportWithExecution = {
    ...report,
    execution,
  };
  const models = toModelRows(await loadForecastModelReferences());
  const envelope = UnifiedLogSchema.parse({
    schema: "investor.daily-log.v1",
    generatedAt: nowIso,
    models,
    report: reportWithExecution,
  });
  const logsDir = join(core.config.paths.logs, "daily");
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(
    join(logsDir, `${reportWithExecution.date}.json`),
    `${JSON.stringify(envelope, null, 2)}\n`,
    "utf8",
  );

  const readinessReport = runLlmAgentReadiness(core.config.paths.logs);
  const readinessEnvelope = UnifiedLogSchema.parse({
    schema: "investor.readiness-report.v1",
    generatedAt: nowIso,
    report: readinessReport,
  });
  const readinessDir = join(core.config.paths.logs, "readiness");
  mkdirSync(readinessDir, { recursive: true });
  writeFileSync(
    join(readinessDir, `${reportWithExecution.date}.json`),
    `${JSON.stringify(readinessEnvelope, null, 2)}\n`,
    "utf8",
  );

  const finalLog = envelope;

  // 7. ACE Continuous Improvement Loop (Reflector/Curator)
  try {
    const playbook = new ContextPlaybook();
    await playbook.load();
    const evaluator = new AceEvaluator();
    const evaluation = await evaluator.evaluate(finalLog);

    const evolver = new AceEvolver(playbook);
    await evolver.evolve(evaluation);

    // 8. OpenCE: Acquisition Pillar (Alpha Frontier Discovery)
    const acquirer = new AceAcquirer();
    const frontiers = await acquirer.acquire();
    for (const content of frontiers) {
      playbook.addBullet({
        content,
        section: "strategies_and_hard_rules",
        metadata: { source: "AceAcquirer", type: "HYPOTHESIS" },
      });
    }
    await playbook.save();
  } catch (aceError) {
    console.warn("ACE Loop failed (non-critical):", aceError);
  }

  return finalLog;
}
