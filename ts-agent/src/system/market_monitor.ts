import { logger } from "../utils/logger.ts";
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
  private readonly logger = logger.child({ service: "MarketMonitor" });

  /**
   * 現在の相場レジームやボラティリティを取得するよっ！📈
   */
  public async getCurrentState(): Promise<SystemStateSnapshot> {
    // 実際の実装は DB や外部 API から取得するけど、今はデフォルト値を返すねっ
    return {
      regime: "STABLE",
      volatility: "LOW",
      driftAlerts: 0,
      updatedAt: new Date().toISOString(),
    };
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

    const te = Number(report.metrics.trackingError ?? 0);
    const mdd = Math.abs(Number(report.metrics.maxDrawdown ?? 0));
    const winRate = Number(report.metrics.winRate ?? 1);

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
