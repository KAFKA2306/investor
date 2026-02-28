import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import {
  DailyLogEnvelopeSchema,
  BenchmarkLogPayloadSchema,
  UnifiedLogPayloadSchema,
  ReadinessLogPayloadSchema,
  AlphaDiscoveryPayloadSchema,
  UQTLEventSchema,
} from "../types/schemas";
import type {
  DailyLogEnvelope,
  BenchmarkLogPayload,
  UnifiedLogPayload,
  ReadinessLogPayload,
  AlphaDiscoveryPayload,
  UQTLEvent,
} from "../types/schemas";
import { canonicalDate } from "../utils/formatters";

const fetchJson = async <T>(path: string, schema: any): Promise<T | null> => {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const result = schema.safeParse(data);
    if (!result.success) {
      console.warn(`Schema validation failed for ${path}:`, result.error);
      return data as T;
    }
    return result.data as T;
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    return null;
  }
};

const listLogFiles = async (bucket: string): Promise<string[]> => {
  const res = await fetch(`/logs/__index?bucket=${encodeURIComponent(bucket)}`);
  if (!res.ok) return [];
  return (await res.json()) as string[];
};

export const useDashboardData = () => {
  const [dailyByDate, setDailyByDate] = useState<Map<string, DailyLogEnvelope>>(
    new Map(),
  );
  const [benchmarkByDate, setBenchmarkByDate] = useState<
    Map<string, BenchmarkLogPayload>
  >(new Map());
  const [unifiedByDate, setUnifiedByDate] = useState<
    Map<string, UnifiedLogPayload>
  >(new Map());
  const [readinessByDate, setReadinessByDate] = useState<
    Map<string, ReadinessLogPayload>
  >(new Map());
  const [alphaByDate, setAlphaByDate] = useState<
    Map<string, AlphaDiscoveryPayload[]>
  >(new Map());
  const [uqtlEvents, setUqtlEvents] = useState<UQTLEvent[]>([]);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dailyFiles = await listLogFiles("daily");
      const nextDailyMap = new Map<string, DailyLogEnvelope>();

      await Promise.all(
        dailyFiles.map(async (file) => {
          const payload = await fetchJson<DailyLogEnvelope>(
            `/logs/daily/${file}`,
            DailyLogEnvelopeSchema,
          );
          if (!payload) return;
          const stem = file.replace(/\.json$/, "");
          const date = canonicalDate(payload.report?.date ?? stem);
          if (date) nextDailyMap.set(date, payload);
        }),
      );

      const sortedTimeline = Array.from(nextDailyMap.keys()).sort((a, b) =>
        b.localeCompare(a),
      );
      setDailyByDate(nextDailyMap);
      setTimeline(sortedTimeline);

      const benchFiles = await listLogFiles("benchmarks");
      const nextBenchMap = new Map<string, BenchmarkLogPayload>();
      await Promise.all(
        benchFiles.map(async (file) => {
          const payload = await fetchJson<BenchmarkLogPayload>(
            `/logs/benchmarks/${file}`,
            BenchmarkLogPayloadSchema,
          );
          if (!payload) return;
          const date = canonicalDate(
            payload.report?.date ?? file.replace(/\.json$/, ""),
          );
          if (date) nextBenchMap.set(date, payload);
        }),
      );
      setBenchmarkByDate(nextBenchMap);

      const unifiedFiles = await listLogFiles("unified");
      const nextUnifiedMap = new Map<string, UnifiedLogPayload>();
      const nextAlphaMap = new Map<string, AlphaDiscoveryPayload[]>();
      await Promise.all(
        unifiedFiles.map(async (file) => {
          const payload = await fetchJson<any>(
            `/logs/unified/${file}`,
            UnifiedLogPayloadSchema,
          );
          if (!payload) return;

          if (payload.schema === "investor.unified-log.v1") {
            const date = canonicalDate(
              payload.date ?? file.replace(/\.json$/, ""),
            );
            if (date) nextUnifiedMap.set(date, payload);
          } else if (payload.schema === "investor.alpha-discovery.v1") {
            const date = canonicalDate(
              payload.date ?? file.replace(/\.json$/, ""),
            );
            if (date) {
              const bucket = nextAlphaMap.get(date) ?? [];
              bucket.push(payload as AlphaDiscoveryPayload);
              nextAlphaMap.set(date, bucket);
            }
          }
        }),
      );
      setUnifiedByDate(nextUnifiedMap);
      setAlphaByDate(nextAlphaMap);

      const readinessFiles = await listLogFiles("readiness");
      const nextReadinessMap = new Map<string, ReadinessLogPayload>();
      await Promise.all(
        readinessFiles.map(async (file) => {
          const payload = await fetchJson<ReadinessLogPayload>(
            `/logs/readiness/${file}`,
            ReadinessLogPayloadSchema,
          );
          if (!payload) return;
          const date = canonicalDate(file.replace(/\.json$/, ""));
          if (date) nextReadinessMap.set(date, payload);
        }),
      );
      setReadinessByDate(nextReadinessMap);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUqtl = useCallback(async () => {
    const events = await fetchJson<UQTLEvent[]>(
      "/api/uqtl?limit=100",
      z.array(UQTLEventSchema),
    );
    if (events) setUqtlEvents(events);
  }, []);

  useEffect(() => {
    refresh();
    refreshUqtl();
    const timer = setInterval(refresh, 60000);
    const uqtlTimer = setInterval(refreshUqtl, 5000);
    return () => {
      clearInterval(timer);
      clearInterval(uqtlTimer);
    };
  }, [refresh, refreshUqtl]);

  return {
    dailyByDate,
    benchmarkByDate,
    unifiedByDate,
    readinessByDate,
    alphaByDate,
    uqtlEvents,
    timeline,
    loading,
    refresh,
  };
};
