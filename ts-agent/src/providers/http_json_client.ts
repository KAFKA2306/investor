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
  maxRetries?: number;
  retryDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export type RequestJsonResult = {
  payload: JsonMap;
  cached: boolean;
  status: number;
  finalUrl: string;
};

/**
 * URLを可愛く組み立てるよっ！🌐✨
 */
export function buildUrl(
  base: string,
  endpoint: string,
  query?: Record<string, QueryValue>,
): string {
  const url = new URL(`${base}${endpoint}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.append(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function requestJson(
  options: RequestJsonOptions,
): Promise<RequestJsonResult> {
  const urlStr = options.url
    ? options.url
    : buildUrl(options.baseUrl ?? "", options.endpoint ?? "", options.query);
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

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      const response = await fetch(urlStr, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = retryDelay * 2 ** attempt;
          console.warn(
            `⚠️ [HTTP ${response.status}] Retrying ${urlStr} in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new ProviderHttpError(
          response.status,
          urlStr,
          await response.text().catch(() => "Unknown error"),
        );
      }

      const payload = (await response.json()) as JsonMap;
      const validated = z.record(z.string(), z.unknown()).parse(payload);

      return {
        payload: validated,
        cached: false,
        status: response.status,
        finalUrl: urlStr,
      };
    } catch (err: any) {
      lastError = err;
      if (
        (err.name === "AbortError" || err.message?.includes("fetch")) &&
        attempt < maxRetries
      ) {
        const delay = retryDelay * 2 ** attempt;
        console.warn(
          `⚠️ [${err.name}] Retrying ${urlStr} in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`Request failed after ${maxRetries} retries`);
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
