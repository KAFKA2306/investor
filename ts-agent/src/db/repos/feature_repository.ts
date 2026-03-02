import { BaseRepository } from "./base_repository.ts";

export type FeatureVersionInput = {
  featureName: string;
  version: string;
  formula: string;
  status?: string;
};

export type EventFeatureInput = {
  eventFeatureId: string;
  sourceDocId: string;
  instrumentId: string;
  filedAt: string;
  featureName: string;
  featureVersion: string;
  riskDelta: number;
  sentiment: number;
  aiExposure: number;
  kgCentrality: number;
  correctionFlag: boolean;
  correctionCount90d: number;
};

export type SignalGateDecisionInput = {
  signalId: string;
  gateName: string;
  tradingDate: string;
  passed: boolean;
  thresholdText: string;
  actualValue: number | null;
  reason: string;
};

export class FeatureRepository extends BaseRepository {
  public async upsertFeatureVersion(input: FeatureVersionInput): Promise<void> {
    await this.executeUpsert({
      table: "feature.feature_version",
      conflictTarget: ["feature_name", "version"],
      data: {
        feature_name: input.featureName,
        version: input.version,
        formula: input.formula,
        status: input.status ?? "ACTIVE",
      },
    });
  }

  public async upsertEventFeature(input: EventFeatureInput): Promise<void> {
    await this.executeUpsert({
      table: "feature.event_feature",
      conflictTarget: "event_feature_id",
      data: {
        event_feature_id: input.eventFeatureId,
        source_doc_id: input.sourceDocId,
        instrument_id: input.instrumentId,
        filed_at: input.filedAt,
        feature_name: input.featureName,
        feature_version: input.featureVersion,
        risk_delta: input.riskDelta,
        sentiment: input.sentiment,
        ai_exposure: input.aiExposure,
        kg_centrality: input.kgCentrality,
        correction_flag: input.correctionFlag,
        correction_count_90d: input.correctionCount90d,
      },
      casts: {
        filed_at: "timestamptz",
      },
    });
  }

  public async upsertSignalGateDecision(
    input: SignalGateDecisionInput,
  ): Promise<void> {
    await this.executeUpsert({
      table: "feature.signal_gate_decision",
      conflictTarget: ["signal_id", "gate_name"],
      data: {
        signal_id: input.signalId,
        gate_name: input.gateName,
        trading_date: input.tradingDate,
        passed: input.passed,
        threshold_text: input.thresholdText,
        actual_value: input.actualValue,
        reason: input.reason,
      },
      casts: {
        trading_date: "date",
      },
    });
  }
}
