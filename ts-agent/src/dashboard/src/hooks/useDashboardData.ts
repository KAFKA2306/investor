import { useCallback, useEffect, useState } from "react";
import {
  canonicalDate,
  type DailyLogEnvelope,
  DailyLogEnvelopeSchema,
} from "../dashboard_core.ts";

const fetchJson = async <T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T | null> => {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const result = schema.safeParse(data);
    return result.success ? result.data : (data as T);
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    return null;
  }
};

const listLogFiles = async (bucket: string): Promise<string[]> => {
  const res = await fetch(`/logs/__index?bucket=${encodeURIComponent(bucket)}`);
  return res.ok ? ((await res.json()) as string[]) : [];
};

export const useDashboardData = () => {
  const [dailyByDate, setDailyByDate] = useState<Map<string, DailyLogEnvelope>>(
    new Map(),
  );
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
          const date = canonicalDate(
            payload.report?.date ?? file.replace(/\.json$/, ""),
          );
          if (date) nextDailyMap.set(date, payload);
        }),
      );
      setTimeline(
        Array.from(nextDailyMap.keys()).sort((a, b) => b.localeCompare(a)),
      );
      setDailyByDate(nextDailyMap);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { dailyByDate, timeline, loading, refresh };
};
