import { z } from "zod";
import type { SqliteHttpCache } from "./cache_providers.ts";
import { ProviderHttpError, ProviderPayloadError } from "./provider_errors.ts";

export type JsonMap = Record<string, unknown>;
export type QueryValue = string | number | boolean | null | undefined;

export type RequestJsonOptions = {
  baseUrl?: string;
  endpoint?: string;
  url?: string;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  cache?: SqliteHttpCache;
  ttlMs?: number;
  allowStaleCache?: boolean;
  timeoutMs?: number;
};

export type RequestJsonResult = {
  payload: JsonMap;
  cached: boolean;
  status: number;
  finalUrl: string;
};

export async function requestJson(
  options: RequestJsonOptions,
): Promise<RequestJsonResult> {
  const fullUrl = options.url
    ? new URL(options.url)
    : new URL(`${options.baseUrl ?? ""}${options.endpoint ?? ""}`);

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null) {
        fullUrl.searchParams.append(k, String(v));
      }
    }
  }

  const urlStr = fullUrl.toString();
  const headers = options.headers ?? {};

  if (options.cache && options.ttlMs !== undefined) {
    const cached = await options.cache.fetchJson(
      urlStr,
      headers,
      options.ttlMs,
      { allowStale: options.allowStaleCache ?? false },
    );
    if (cached.cached) {
      return {
        payload: cached.payload as JsonMap,
        cached: true,
        status: 200,
        finalUrl: urlStr,
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30000,
  );

  const response = await fetch(urlStr, {
    headers,
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new ProviderHttpError(
      response.status,
      urlStr,
      await response.text().catch(() => "Unknown error"),
    );
  }

  const payload = (await response.json()) as JsonMap;
  const validated = z.record(z.string(), z.unknown()).parse(payload);

  clearTimeout(timeout);

  return {
    payload: validated,
    cached: false,
    status: response.status,
    finalUrl: urlStr,
  };
}

export async function requestRows(
  options: RequestJsonOptions,
): Promise<unknown[]> {
  const result = await requestJson(options);
  const payload = result.payload;

  // J-Quants 互換の rows 抽出ロジック
  const topLevel = Object.values(payload).find((v) => Array.isArray(v));
  const nested = Object.values(payload)
    .filter((v) => typeof v === "object" && v !== null && !Array.isArray(v))
    .flatMap((v) => Object.values(v as Record<string, unknown>))
    .find((v) => Array.isArray(v));

  const rows = topLevel || nested || [];
  if (!Array.isArray(rows)) {
    throw new ProviderPayloadError("Failed to extract rows from response");
  }
  return rows;
}
