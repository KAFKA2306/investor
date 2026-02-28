import { join } from "node:path";
import { Table, tableFromArrays, tableToIPC } from "apache-arrow";
import { spawn } from "bun";
import type { ComputeRequest, ComputeResponse } from "./compute_client";
import { core } from "./index.ts";

/**
 * High-performance Arrow-based Compute Client (Generation 3: Infinity).
 * Uses Zero-Copy Arrow IPC to eliminate JSON serialization overhead for market data.
 */
export class ArrowComputeClient {
  private readonly enginePath: string;
  private readonly venvPython: string;

  constructor() {
    this.enginePath = join(import.meta.dir, "..", "compute", "engine.py");
    this.venvPython = core.getVenvPythonPath();
  }

  public async evaluateFactors(
    request: ComputeRequest,
  ): Promise<ComputeResponse> {
    // 1. Convert factors to a compact JSON string (passed as a command line argument or separate header)
    const factorsJson = JSON.stringify(request.factors);
    const baselineJson = JSON.stringify(request.baseline_scores || []);

    // 2. Convert Market Data to Arrow Table
    const table = this.convertToArrowTable(
      request.market_data as unknown as Record<string, unknown>[],
    );
    const ipcBuffer = tableToIPC(table, "stream");

    // 3. Spawn process with --format arrow
    const proc = spawn({
      cmd: [
        this.venvPython,
        this.enginePath,
        "--format",
        "arrow",
        "--factors",
        factorsJson,
        "--baseline",
        baselineJson,
      ],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    try {
      // Write Arrow Stream to stdin
      proc.stdin.write(ipcBuffer);
      proc.stdin.end();

      // The output is still expected to be JSON for now (summary results)
      // but the heavy lifting (input) is now Zero-Copy Arrow.
      const output = await new Response(proc.stdout).text();
      const errorOutput = await new Response(proc.stderr).text();

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new Error(
          `Arrow Compute Engine Failed (Exit ${exitCode}): ${errorOutput}`,
        );
      }

      if (!output.trim()) {
        throw new Error("Arrow Compute Engine returned empty output.");
      }

      return JSON.parse(output) as ComputeResponse;
    } catch (e) {
      console.error("[ArrowComputeClient] Fatal error:");
      console.error(e);
      proc.kill();
      throw e;
    }
  }

  private convertToArrowTable(data: Record<string, unknown>[]): Table {
    if (data.length === 0) return new Table();

    // Extract columns for Arrow
    const columns: Record<string, unknown[]> = {};
    const keys = Object.keys(data[0]!);

    for (const key of keys) {
      columns[key] = data.map((d) => d[key]);
    }

    // In apache-arrow >= 13.0.0, tableFromArrays is the most robust way to create tables from column-arrays.
    return tableFromArrays(columns);
  }
}
