import { join } from "node:path";
import { spawn } from "bun";
import { core } from "../system/app_runtime_core.ts";

export interface ComputeFactor {
  id: string;
  ast: Record<string, unknown>;
}

export interface ComputeMarketData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover_value: number;
  net_sales?: number;
  operating_profit?: number;
  profit_margin?: number;
}

export interface ComputeRequest {
  factors: ComputeFactor[];
  market_data: ComputeMarketData[];
  baseline_scores?: number[];
}

export interface FactorComputeResult {
  factor_id: string;
  status: "success" | "error";
  message?: string;
  ic_proxy?: number;
  orthogonality?: number;
  orth_corr?: number;
  mean_score?: number;
  backtest?: {
    gross_return: number;
    net_return: number;
    signals_count: number;
  };
  scores?: { symbol: string; score: number }[];
}

export interface ComputeResponse {
  status: "success" | "fatal_error";
  message?: string;
  results?: FactorComputeResult[];
}

export class ComputeEngineClient {
  private readonly enginePath: string;
  private readonly venvPython: string;

  constructor() {
    this.enginePath = join(import.meta.dir, "..", "compute", "engine.py");

    this.venvPython = core.getVenvPythonPath();
  }

  public async evaluateFactors(
    request: ComputeRequest,
  ): Promise<ComputeResponse> {
    const inputJson = JSON.stringify(request);

    const cmd = this.venvPython.endsWith("uv")
      ? [this.venvPython, "run", this.enginePath]
      : [this.venvPython, this.enginePath];

    const proc = spawn({
      cmd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    proc.stdin.write(inputJson);
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      proc.kill();
      throw new Error(
        `Compute Engine Failed (Exit ${exitCode}): ${errorOutput}`,
      );
    }

    if (!output.trim()) {
      proc.kill();
      throw new Error("Compute Engine returned empty output.");
    }

    const parsed = JSON.parse(output) as ComputeResponse;
    if (parsed.status === "fatal_error") {
      proc.kill();
      throw new Error(`Compute Engine Fatal Error: ${parsed.message}`);
    }

    return parsed;
  }
}
