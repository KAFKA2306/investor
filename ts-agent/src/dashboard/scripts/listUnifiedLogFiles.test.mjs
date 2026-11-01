import { expect, test } from "bun:test";
import { listUnifiedLogFiles } from "../src/utils/listUnifiedLogFiles.ts";

const paths = { logsUnifiedBase: "logs/unified", logsIndex: "logs/__index" };

test("static Pages manifest takes precedence and rejects unsafe filenames", async () => {
  const requested = [];
  const request = async (url) => {
    requested.push(url);
    return {
      ok: true,
      json: async () => [
        "20261101.json",
        "manifest.json",
        "../private.json",
        "nested/data.json",
        "data.txt",
        42,
      ],
    };
  };
  expect(await listUnifiedLogFiles("/investor/", paths, request)).toEqual([
    "20261101.json",
  ]);
  expect(requested).toEqual(["/investor/logs/unified/manifest.json"]);
});

test("local Vite index is used when the static manifest is absent", async () => {
  const requested = [];
  const request = async (url) => {
    requested.push(url);
    if (url.endsWith("/manifest.json")) return { ok: false };
    return { ok: true, json: async () => ["local.json"] };
  };
  expect(await listUnifiedLogFiles("/investor", paths, request)).toEqual([
    "local.json",
  ]);
  expect(requested).toEqual([
    "/investor/logs/unified/manifest.json",
    "/investor/logs/__index?bucket=unified",
  ]);
});

test("failed or malformed indexes produce an empty list", async () => {
  const request = async (url) => {
    if (url.endsWith("/manifest.json")) throw new Error("network");
    return { ok: true, json: async () => ({ unexpected: true }) };
  };
  expect(await listUnifiedLogFiles("/investor/", paths, request)).toEqual([]);
});
