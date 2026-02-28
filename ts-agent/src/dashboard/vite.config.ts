import { readdir, readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoLogsDir = resolve(__dirname, "../../../../logs");

const json = (value: unknown) => JSON.stringify(value, null, 2);

const contentType = (path: string): string => {
  const ext = extname(path).toLowerCase();
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
};

const normalizePath = (value: string): string =>
  value.replace(/^\/+/, "").replaceAll("\\", "/");

const isSafePath = (fullPath: string): boolean =>
  fullPath === repoLogsDir || fullPath.startsWith(`${repoLogsDir}/`);

const createLogsMiddleware =
  () =>
  async (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    next: () => void,
  ) => {
    if (!req.url || req.method !== "GET") {
      next();
      return;
    }

    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__index") {
      const bucket = url.searchParams.get("bucket") ?? "";
      if (!bucket) {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(json({ error: "bucket is required" }));
        return;
      }

      const targetDir = resolve(repoLogsDir, normalizePath(bucket));
      if (!isSafePath(targetDir)) {
        res.statusCode = 403;
        res.end("forbidden");
        return;
      }

      try {
        const entries = await readdir(targetDir, { withFileTypes: true });
        const files = entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.endsWith(".json") &&
              entry.name !== "manifest.json",
          )
          .map((entry) => entry.name)
          .sort();
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(json(files));
        return;
      } catch {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
    }

    const relPath = normalizePath(url.pathname);
    const targetFile = resolve(repoLogsDir, relPath);
    if (!isSafePath(targetFile)) {
      res.statusCode = 403;
      res.end("forbidden");
      return;
    }

    try {
      const fileStat = await stat(targetFile);
      if (!fileStat.isFile()) {
        next();
        return;
      }
      const data = await readFile(targetFile);
      res.statusCode = 200;
      res.setHeader("content-type", contentType(targetFile));
      res.end(data);
      return;
    } catch {
      next();
      return;
    }
  };

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/investor/
  base: "/investor/",
  plugins: [
    react(),
    {
      name: "serve-repo-logs",
      configureServer(server) {
        server.middlewares.use("/logs", createLogsMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use("/logs", createLogsMiddleware());
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
