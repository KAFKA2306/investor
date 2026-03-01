import { describe, expect, test } from "bun:test";
import type { SqliteHttpCache } from "./cache_providers.ts";
import { requestJson } from "./http_json_client.ts";

describe("requestJson", () => {
  test("passes allowStaleCache to cache provider", async () => {
    let receivedAllowStale: boolean | undefined;
    const cache = {
      fetchJson: async (
        _url: string,
        _headers: Record<string, string>,
        _ttlMs: number,
        options?: { allowStale?: boolean },
      ) => {
        receivedAllowStale = options?.allowStale;
        return {
          payload: { hello: "world" },
          cached: true,
        };
      },
    };

    const result = await requestJson({
      url: "https://example.com/api",
      headers: { "x-test": "1" },
      cache: cache as unknown as SqliteHttpCache,
      ttlMs: 1000,
      allowStaleCache: true,
    });

    expect(result.cached).toBe(true);
    expect(result.payload.hello).toBe("world");
    expect(receivedAllowStale).toBe(true);
  });
});
