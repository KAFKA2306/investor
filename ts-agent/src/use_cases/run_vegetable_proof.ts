import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { executePaperOrders } from "../execution/paper_executor.ts";
import { MarketdataLocalGateway } from "../experiments/gateways/marketdata_local_gateway.ts";
import { runVegetableScenario } from "../experiments/scenarios/vegetable_daily.ts";
import {
  loadForecastModelReferences,
  type ModelReference,
} from "../model_registry/registry.ts";
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

const VegetableUniverse = ["1375", "1332", "2503"] as const;

export async function runVegetableProof(): Promise<UnifiedLog> {
  const nowIso = new Date().toISOString();
  const gateway = await MarketdataLocalGateway.create(VegetableUniverse);
  const marketDataEnd = await gateway.getMarketDataEndDate();
  const anchor = new Date(
    `${marketDataEnd.slice(0, 4)}-${marketDataEnd.slice(4, 6)}-${marketDataEnd.slice(6, 8)}T00:00:00.000Z`,
  );
  const report = await runVegetableScenario(
    gateway,
    nowIso,
    lastCalendarDays(20, anchor),
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
  const logsDir = resolve(process.cwd(), "../logs/daily");
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(
    resolve(logsDir, `${reportWithExecution.date}.json`),
    `${JSON.stringify(envelope, null, 2)}\n`,
    "utf8",
  );
  return envelope;
}
