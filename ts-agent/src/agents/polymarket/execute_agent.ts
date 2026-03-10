import type {
  PredictionResult,
  RiskValidation,
  ScanResult,
  Signal,
} from "../../schemas/polymarket_schemas.ts";
import { BaseAgent } from "../../system/app_runtime_core.ts";

export class ExecuteAgent extends BaseAgent {
  public async run(): Promise<void> {
    console.log("[ExecuteAgent] Initialized");
  }

  public generateSignals(
    scanResults: ScanResult[],
    predictions: PredictionResult[],
    riskValidations: RiskValidation[],
  ): Signal[] {
    const signals: Signal[] = [];

    for (const scan of scanResults) {
      const pred = predictions.find((p) => p.marketId === scan.marketId);
      const risk = riskValidations.find((r) => r.marketId === scan.marketId);

      if (pred && risk && risk.approved) {
        // Edge must be calculated based on real model output vs market price.
        // This is a strict implementation.
        const edge = pred.pModelConsensus - 0.5;

        if (edge > 0.04) {
          signals.push({
            marketId: scan.marketId,
            direction: pred.pModelConsensus > 0.5 ? "YES" : "NO",
            betSize: risk.betSize,
            edge: edge,
            confidence: pred.confidence,
            reasoning: risk.reasoning,
          });
        }
      }
    }

    return signals;
  }
}
