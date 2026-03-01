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
    await this.db.query(
      `
      INSERT INTO feature.feature_version (feature_name, version, formula, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(feature_name, version) DO UPDATE SET
        formula = EXCLUDED.formula,
        status = EXCLUDED.status
      `,
      [
        input.featureName,
        input.version,
        input.formula,
        input.status ?? "ACTIVE",
      ],
    );
  }

  public async upsertEventFeature(input: EventFeatureInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO feature.event_feature
      (event_feature_id, source_doc_id, instrument_id, filed_at, feature_name, feature_version,
       risk_delta, sentiment, ai_exposure, kg_centrality, correction_flag, correction_count_90d)
      VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(event_feature_id) DO UPDATE SET
        source_doc_id = EXCLUDED.source_doc_id,
        instrument_id = EXCLUDED.instrument_id,
        filed_at = EXCLUDED.filed_at,
        feature_name = EXCLUDED.feature_name,
        feature_version = EXCLUDED.feature_version,
        risk_delta = EXCLUDED.risk_delta,
        sentiment = EXCLUDED.sentiment,
        ai_exposure = EXCLUDED.ai_exposure,
        kg_centrality = EXCLUDED.kg_centrality,
        correction_flag = EXCLUDED.correction_flag,
        correction_count_90d = EXCLUDED.correction_count_90d
      `,
      [
        input.eventFeatureId,
        input.sourceDocId,
        input.instrumentId,
        input.filedAt,
        input.featureName,
        input.featureVersion,
        input.riskDelta,
        input.sentiment,
        input.aiExposure,
        input.kgCentrality,
        input.correctionFlag,
        input.correctionCount90d,
      ],
    );
  }

  public async upsertSignalGateDecision(
    input: SignalGateDecisionInput,
  ): Promise<void> {
    await this.db.query(
      `
      INSERT INTO feature.signal_gate_decision
      (signal_id, gate_name, trading_date, passed, threshold_text, actual_value, reason)
      VALUES ($1, $2, $3::date, $4, $5, $6, $7)
      ON CONFLICT(signal_id, gate_name) DO UPDATE SET
        trading_date = EXCLUDED.trading_date,
        passed = EXCLUDED.passed,
        threshold_text = EXCLUDED.threshold_text,
        actual_value = EXCLUDED.actual_value,
        reason = EXCLUDED.reason
      `,
      [
        input.signalId,
        input.gateName,
        input.tradingDate,
        input.passed,
        input.thresholdText,
        input.actualValue,
        input.reason,
      ],
    );
  }
}
