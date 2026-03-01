import { core } from "./app_runtime_core.ts";
import { paths } from "./path_registry.ts";

export type ResearchInputManifest = {
  dataRoot: string;
  verificationRoot: string;
  playbookPath: string;
  symbols: string[];
  asOfDate: string;
  qualityScore: number;
};

export type VerificationWindow = {
  from: string;
  to: string;
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const toYmd = (d: Date): string =>
  `${d.getUTCFullYear()}${`${d.getUTCMonth() + 1}`.padStart(2, "0")}${`${d.getUTCDate()}`.padStart(2, "0")}`;

export class QuantResearchRuntime {
  public buildManifest(
    symbols: string[],
    asOfDate: string,
    qualityScore: number,
  ): ResearchInputManifest {
    return {
      dataRoot: paths.dataRoot,
      verificationRoot: paths.verificationRoot,
      playbookPath: `${paths.verificationRoot}/playbook.json`,
      symbols,
      asOfDate,
      qualityScore,
    };
  }

  public selectFoundationModelId(
    context: string,
    qualityScore: number,
  ): string {
    if (context.includes("Bullish") && qualityScore >= 0.75)
      return "les-forecast-v2-momentum";
    if (qualityScore < 0.65) return "les-forecast-v1-robust";
    return "les-forecast-v1";
  }

  public selectLearningRate(retryMode: "MODEL" | "NONE"): number {
    return retryMode === "MODEL" ? 5e-5 : 1e-4;
  }

  public deriveVerificationWindow(asOfDate: string): VerificationWindow {
    if (!/^\d{8}$/.test(asOfDate)) {
      const now = new Date();
      const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return { from: toYmd(past), to: toYmd(now) };
    }
    const y = Number(asOfDate.slice(0, 4));
    const m = Number(asOfDate.slice(4, 6));
    const d = Number(asOfDate.slice(6, 8));
    const end = new Date(Date.UTC(y, m - 1, d));
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    return { from: toYmd(start), to: toYmd(end) };
  }

  public scoreNoveltyBoost(score: number): number {
    return clamp(score + 0.05, 0, 1);
  }

  public netReturnFromPriority(priority: number): number {
    return priority * 0.2;
  }

  public totalCostBps(): number {
    const c = core.config.execution.costs;
    return c.feeBps + c.slippageBps;
  }
}
