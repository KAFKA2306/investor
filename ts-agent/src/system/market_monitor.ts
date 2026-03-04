import { core } from "./app_runtime_core.ts";

export interface SystemStateSnapshot {
  regime: string;
  volatility: string;
  driftAlerts: number;
  updatedAt: string;
  regimeScore?: number;
  volatilityScore?: number;
}

export interface DriftReport {
  strategyId: string;
  driftDetected: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH";
  recommendation: "CONTINUE" | "ADJUST" | "HALT";
  metrics: Record<string, number>;
}

/**
 * ✨ 市場環境とシステムの健康状態を監視するサービス ✨
 */
export class MarketMonitor {
  /**
   * 現在の相場レジームやボラティリティを取得するよっ！📈
   */
  public async getCurrentState(): Promise<SystemStateSnapshot> {
    throw new Error(
      "[AUDIT] MarketMonitor.getCurrentState: No real-time data available. Fail Fast.",
    );
  }

  /**
   * ドリフト（乖離）が発生していないかチェックするよっ！🔍
   */
  public evaluateDrift(report: DriftReport): {
    detected: boolean;
    severity: "LOW" | "MEDIUM" | "HIGH";
  } {
    const threshold = core.config.pipelineBlueprint?.driftRetraining;
    if (!threshold) return { detected: false, severity: "LOW" };

    if (report.metrics.trackingError === undefined)
      throw new Error("[AUDIT] missing trackingError");
    if (report.metrics.maxDrawdown === undefined)
      throw new Error("[AUDIT] missing maxDrawdown");
    if (report.metrics.winRate === undefined)
      throw new Error("[AUDIT] missing winRate");

    const te = Number(report.metrics.trackingError);
    const mdd = Math.abs(Number(report.metrics.maxDrawdown));
    const winRate = Number(report.metrics.winRate);

    const detected =
      te > threshold.maxTrackingError ||
      mdd > threshold.maxRollingDrawdown ||
      winRate < threshold.minWinRate;

    return {
      detected,
      severity: detected ? "HIGH" : "LOW",
    };
  }
}

export const marketMonitor = new MarketMonitor();
