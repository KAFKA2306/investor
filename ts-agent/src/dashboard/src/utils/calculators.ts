import type {
  DailyReport,
  ReadinessLogPayload,
  UnifiedLogPayload,
} from "../types/schemas";
import { pickNumber, clamp01 } from "./formatters";

export const computeConfidence = (
  report: DailyReport,
  readiness: ReadinessLogPayload | null,
): number => {
  const evidencePassCount = [
    report.evidence?.estat?.status,
    report.evidence?.jquants?.status,
    report.results?.status,
  ].filter((status) => status === "PASS").length;

  const readinessScore = pickNumber(readiness?.report?.score?.total) / 100;
  const edgeScore = clamp01(pickNumber(report.results?.expectedEdge) / 0.25);
  const returnScore = clamp01(
    (pickNumber(report.results?.basketDailyReturn) + 0.03) / 0.06,
  );
  const evidenceScore = clamp01(evidencePassCount / 3);

  return clamp01(
    edgeScore * 0.35 +
      returnScore * 0.25 +
      evidenceScore * 0.25 +
      readinessScore * 0.15,
  );
};

export const computeUqtlVector = (
  report: DailyReport,
  unified: UnifiedLogPayload | null,
  readiness: ReadinessLogPayload | null,
) => {
  const readinessScore = clamp01(
    pickNumber(readiness?.report?.score?.total) / 100,
  );
  const stageRows = unified?.stages ?? [];
  const passStages = stageRows.filter((stage) =>
    (stage.status ?? "").toUpperCase().includes("PASS"),
  ).length;
  const logic =
    stageRows.length > 0 ? clamp01(passStages / stageRows.length) : 0.45;
  const stopLoss = pickNumber(report.risks?.stopLossPct);
  const kelly = pickNumber(report.risks?.kellyFraction);
  const risk = clamp01(1 - stopLoss * 4 + kelly * 0.6);
  const evidencePassCount = [
    report.evidence?.estat?.status,
    report.evidence?.jquants?.status,
    report.results?.status,
  ].filter((status) => (status ?? "").toUpperCase().includes("PASS")).length;
  const data = clamp01(evidencePassCount / 3);
  const time = clamp01(readinessScore * 0.6 + data * 0.4);
  const certainty = (time + logic + risk + data) / 4;
  const entropy = clamp01(1 - certainty);
  return { time, logic, risk, data, entropy };
};
