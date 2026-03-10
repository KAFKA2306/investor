import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteHttpCache } from "./cache_providers.ts";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SqliteHttpCache", () => {
  test("can reuse stale cache when allowStale is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jquants-cache-test-"));
    tempDirs.push(dir);
    const cache = new SqliteHttpCache(join(dir, "http_cache.sqlite"));
    const url = "https://example.com/data";
    const headers = { "x-api-key": "dummy" };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const first = await cache.fetchJson(url, headers, 1);
    expect(first.cached).toBe(false);
    expect(first.payload.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    globalThis.fetch = (async () => {
      throw new Error("network should not be called");
    }) as unknown as typeof fetch;

    const second = await cache.fetchJson(url, headers, 1, {
      allowStale: true,
    });
    expect(second.cached).toBe(true);
    expect(second.payload.ok).toBe(true);

    await expect(cache.fetchJson(url, headers, 1)).rejects.toThrow(
      "network should not be called",
    );

    globalThis.fetch = originalFetch;
    cache.db.close();
  });
});
