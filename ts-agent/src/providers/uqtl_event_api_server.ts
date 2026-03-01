import { readdir, readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { serve } from "bun";
import { MemoryCenter } from "../context/unified_context_services.ts";

interface WorkflowMeta {
  id: string;
  name: string;
  file: string;
  commands: string[];
}

interface WorkflowStepResult {
  command: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

interface TimeSeriesView {
  id: string;
  csvFile: string;
  plotFile: string;
  hasPlot: boolean;
  required: boolean;
}

const memory = new MemoryCenter();
const cwd = process.cwd();
const repoRoot = /(^|[\\/])ts-agent$/.test(cwd) ? resolve(cwd, "..") : cwd;
const workflowDir = resolve(repoRoot, ".agent/workflows");
const timeSeriesDir = resolve(repoRoot, "ts-agent/data");
const maxStdoutChars = 12000;
const maxCommandMs = 8 * 60 * 1000;
const allowedCommandPatterns = [
  /^cd\s+ts-agent\s*&&\s*bun\s+run\s+[\w:-]+(\s+.*)?$/,
  /^bun\s+run\s+[\w:-]+(\s+.*)?$/,
  /^task\s+[\w:-]+(\s+.*)?$/,
  /^ls\s+.*$/,
];

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const trimOutput = (value: string): string => {
  if (value.length <= maxStdoutChars) return value;
  return `${value.slice(0, maxStdoutChars)}\n...[truncated ${value.length - maxStdoutChars} chars]`;
};

const parseWorkflowCommands = (markdown: string): string[] => {
  const matches = Array.from(markdown.matchAll(/`([^`\n]+)`/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const unique = new Set<string>();
  for (const command of matches) {
    if (allowedCommandPatterns.some((pattern) => pattern.test(command))) {
      unique.add(command);
    }
  }

  return Array.from(unique);
};

const readWorkflowCatalog = async (): Promise<WorkflowMeta[]> => {
  const entries = await readdir(workflowDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  const workflows = await Promise.all(
    files.map(async (file): Promise<WorkflowMeta> => {
      const fullPath = resolve(workflowDir, file);
      const markdown = await readFile(fullPath, "utf-8");
      const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file;
      const id = file.replace(/\.md$/, "");
      const commands = parseWorkflowCommands(markdown);
      return { id, name: title, file, commands };
    }),
  );

  return workflows;
};

const runShellCommand = async (
  command: string,
): Promise<WorkflowStepResult> => {
  const started = Date.now();

  const proc = Bun.spawn(["bash", "-c", command], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, maxCommandMs);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  clearTimeout(timer);

  return {
    command,
    ok: !timedOut && exitCode === 0,
    exitCode,
    durationMs: Date.now() - started,
    stdout: trimOutput(stdout),
    stderr: timedOut
      ? `${trimOutput(stderr)}\n[timeout] command exceeded ${maxCommandMs}ms`
      : trimOutput(stderr),
  };
};

const runWorkflow = async (workflowId: string) => {
  const catalog = await readWorkflowCatalog();
  const workflow = catalog.find((item) => item.id === workflowId);
  if (!workflow) {
    return {
      status: 404,
      body: { error: `workflow not found: ${workflowId}` },
    };
  }
  if (workflow.commands.length === 0) {
    return {
      status: 400,
      body: { error: `no executable command in workflow: ${workflowId}` },
    };
  }

  const startedAt = new Date().toISOString();
  const steps: WorkflowStepResult[] = [];
  for (const command of workflow.commands) {
    const step = await runShellCommand(command);
    steps.push(step);
    if (!step.ok) break;
  }
  const endedAt = new Date().toISOString();
  const ok =
    steps.length === workflow.commands.length && steps.every((step) => step.ok);

  return {
    status: 200,
    body: {
      workflowId: workflow.id,
      workflowName: workflow.name,
      startedAt,
      endedAt,
      ok,
      steps,
    },
  };
};

const listTimeSeriesViews = async (): Promise<TimeSeriesView[]> => {
  const entries = await readdir(timeSeriesDir, { withFileTypes: true });
  const names = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );

  return Array.from(names)
    .filter((name) => name.endsWith("_ts.csv"))
    .sort()
    .map((csvFile) => {
      const id = csvFile.replace(/\.csv$/, "");
      const plotFile = `plot_${id}.png`;
      return {
        id,
        csvFile,
        plotFile,
        hasPlot: names.has(plotFile),
        required: csvFile === "sbg_ts.csv",
      };
    })
    .sort(
      (a, b) =>
        Number(b.required) - Number(a.required) || a.id.localeCompare(b.id),
    );
};

const isSafeFileName = (file: string, ext: ".png" | ".csv"): boolean =>
  file === basename(file) && extname(file).toLowerCase() === ext;

const apiPort = Number(process.env.UQTL_API_PORT ?? "8787");
console.log(`UQTL API Server listening on http://localhost:${apiPort}`);

serve({
  port: apiPort,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/uqtl" && req.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const events = memory.getEvents(limit);
      return new Response(JSON.stringify(events), { headers: jsonHeaders });
    }

    if (url.pathname === "/api/stats" && req.method === "GET") {
      const successes = memory.getRecentSuccesses(10);
      const failures = memory.getRecentFailures(10);
      return new Response(JSON.stringify({ successes, failures }), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/api/workflows" && req.method === "GET") {
      const workflows = await readWorkflowCatalog();
      const summarized = workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        file: workflow.file,
        commandCount: workflow.commands.length,
        commands: workflow.commands,
      }));
      return new Response(JSON.stringify(summarized), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/api/workflows/run" && req.method === "POST") {
      const body = (await req.json()) as { workflowId?: string };
      const workflowId = body.workflowId?.trim();
      if (!workflowId) {
        return new Response(
          JSON.stringify({ error: "workflowId is required" }),
          {
            status: 400,
            headers: jsonHeaders,
          },
        );
      }
      const result = await runWorkflow(workflowId);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/api/timeseries/views" && req.method === "GET") {
      const views = await listTimeSeriesViews();
      return new Response(JSON.stringify(views), { headers: jsonHeaders });
    }

    if (
      url.pathname.startsWith("/api/timeseries/plot/") &&
      req.method === "GET"
    ) {
      const file = decodeURIComponent(
        url.pathname.replace("/api/timeseries/plot/", ""),
      );
      if (!isSafeFileName(file, ".png")) {
        return new Response(JSON.stringify({ error: "invalid file name" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const fullPath = resolve(timeSeriesDir, file);
      const payload = await readFile(fullPath);
      return new Response(payload, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/api/kill" && req.method === "POST") {
      console.warn("[API] !!! KILL SWITCH ACTIVATED !!!");
      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "SYSTEM_LOG",
        payload: { message: "KILL SWITCH ACTIVATED via Dashboard" },
      };
      memory.pushEvent(event);
      return new Response(
        JSON.stringify({ ok: true, message: "Kill signal received" }),
        {
          headers: jsonHeaders,
        },
      );
    }

    if (
      url.pathname.startsWith("/api/timeseries/csv/") &&
      req.method === "GET"
    ) {
      const file = decodeURIComponent(
        url.pathname.replace("/api/timeseries/csv/", ""),
      );
      if (!isSafeFileName(file, ".csv")) {
        return new Response(JSON.stringify({ error: "invalid file name" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const fullPath = resolve(timeSeriesDir, file);
      const payload = await readFile(fullPath);
      return new Response(payload, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  },
});
