import { useCallback, useEffect, useState } from "react";
import {
  type AlphaDiscoveryPayload,
  AlphaDiscoveryPayloadSchema,
  CanonicalLogEnvelopeV2Schema,
  canonicalDate,
  type DailyLogEnvelope,
  DailyLogEnvelopeSchema,
  type QualityGatePayload,
  QualityGatePayloadSchema,
  type StandardVerificationData,
  StandardVerificationDataSchema,
  type UnifiedLogPayload,
  UnifiedLogPayloadSchema,
} from "../dashboard_core";

const listUnifiedLogFiles = async (): Promise<string[]> => {
  const res = await fetch(
    // @ts-expect-error
    `${import.meta.env.BASE_URL}logs/__index?bucket=unified`,
  ).catch(() => undefined);
  if (!res?.ok) return [];
  const payload = await res.json().catch(() => []);
  return Array.isArray(payload)
    ? payload.filter((item): item is string => typeof item === "string")
    : [];
};

export const useDashboardData = () => {
  const [dailyByDate, setDailyByDate] = useState<Map<string, DailyLogEnvelope>>(
    new Map(),
  );
  const [benchmarkByDate, setBenchmarkByDate] = useState<
    Map<string, UnifiedLogPayload>
  >(new Map());
  const [unifiedByDate, setUnifiedByDate] = useState<
    Map<string, UnifiedLogPayload>
  >(new Map());
  const [qualityGateByDate, setQualityGateByDate] = useState<
    Map<string, QualityGatePayload>
  >(new Map());
  const [alphaByDate, setAlphaByDate] = useState<
    Map<string, AlphaDiscoveryPayload[]>
  >(new Map());
  const [verificationData, setVerificationData] =
    useState<StandardVerificationData | null>(null);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [ingestErrors, setIngestErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const files = await listUnifiedLogFiles();
    const nextDailyMap = new Map<string, DailyLogEnvelope>();
    const nextBenchmarkMap = new Map<string, UnifiedLogPayload>();
    const nextUnifiedMap = new Map<string, UnifiedLogPayload>();
    const nextQualityGateMap = new Map<string, QualityGatePayload>();
    const nextAlphaMap = new Map<string, AlphaDiscoveryPayload[]>();
    const errors: string[] = [];
    const allDates = new Set<string>();

    const fetchResults = await Promise.allSettled(
      files.map(async (file) => ({
        file,
        res: await fetch(`${import.meta.env.BASE_URL}logs/unified/${file}`, {
          cache: "no-store",
        }),
      })),
    );

    for (const result of fetchResults) {
      if (result.status !== "fulfilled") continue;
      const { file, res } = result.value;
      if (!res.ok) continue;

      const raw = await res.json().catch(() => undefined);
      const parsed = CanonicalLogEnvelopeV2Schema.safeParse(raw);
      if (!parsed.success) {
        errors.push(`${file}: invalid canonical envelope`);
        continue;
      }

      const date = canonicalDate(parsed.data.asOfDate);
      if (!date) {
        errors.push(`${file}: invalid asOfDate`);
        continue;
      }
      allDates.add(date);

      switch (parsed.data.kind) {
        case "daily_decision": {
          const payload = DailyLogEnvelopeSchema.safeParse(parsed.data.payload);
          if (!payload.success) {
            errors.push(`${file}: invalid daily_decision payload`);
            continue;
          }
          nextDailyMap.set(date, payload.data);
          break;
        }
        case "benchmark": {
          const payload = UnifiedLogPayloadSchema.safeParse(
            parsed.data.payload,
          );
          if (!payload.success) {
            errors.push(`${file}: invalid benchmark payload`);
            continue;
          }
          nextBenchmarkMap.set(date, payload.data);
          break;
        }
        case "investment_outcome": {
          const payload = UnifiedLogPayloadSchema.safeParse(
            parsed.data.payload,
          );
          if (!payload.success) {
            errors.push(`${file}: invalid investment_outcome payload`);
            continue;
          }
          nextUnifiedMap.set(date, payload.data);
          break;
        }
        case "quality_gate": {
          const payload = QualityGatePayloadSchema.safeParse(
            parsed.data.payload,
          );
          if (!payload.success) {
            errors.push(`${file}: invalid quality_gate payload`);
            continue;
          }
          nextQualityGateMap.set(date, payload.data);
          break;
        }
        case "alpha_discovery": {
          const payload = AlphaDiscoveryPayloadSchema.safeParse(
            parsed.data.payload,
          );
          if (!payload.success) {
            errors.push(`${file}: invalid alpha_discovery payload`);
            continue;
          }
          const existing = nextAlphaMap.get(date) ?? [];
          nextAlphaMap.set(date, [...existing, payload.data]);
          break;
        }
        default:
          break;
      }
    }

    const sortedDaily = Array.from(nextDailyMap.keys()).sort((a, b) =>
      b.localeCompare(a),
    );
    const sortedAll = Array.from(allDates).sort((a, b) => b.localeCompare(a));
    const nextTimeline = sortedDaily.length > 0 ? sortedDaily : sortedAll;

    setTimeline(nextTimeline);
    setDailyByDate(nextDailyMap);
    setBenchmarkByDate(nextBenchmarkMap);
    setUnifiedByDate(nextUnifiedMap);
    setQualityGateByDate(nextQualityGateMap);
    setAlphaByDate(nextAlphaMap);

    // Set default activeDate if empty
    setActiveDate((prev) =>
      prev === "" && nextTimeline.length > 0 ? nextTimeline[0] : prev,
    );

    // Fetch standard verification data
    // @ts-expect-error
    const verifRes = await fetch(
      `${import.meta.env.BASE_URL}verification/standard_verification_data.json`,
      { cache: "no-store" },
    ).catch(() => undefined);
    if (verifRes?.ok) {
      const verifRaw = await verifRes.json().catch(() => undefined);
      const parsedVerif = StandardVerificationDataSchema.safeParse(verifRaw);
      if (parsedVerif.success) {
        setVerificationData(parsedVerif.data);
      }
    }

    setIngestErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  return {
    dailyByDate,
    benchmarkByDate,
    unifiedByDate,
    qualityGateByDate,
    alphaByDate,
    verificationData,
    timeline,
    activeDate,
    setActiveDate,
    ingestErrors,
    loading,
    refresh,
  };
};
