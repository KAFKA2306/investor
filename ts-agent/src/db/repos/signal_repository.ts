import { BaseRepository } from "./base_repository.ts";

export type SignalInput = {
  signalId: string;
  instrumentId: string;
  tradingDate: string;
  combinedAlpha: number;
  riskDelta: number;
  pead1d: number;
  pead5d: number;
  modelVersion?: string | null;
};

export type SignalLineageInput = {
  signalId: string;
  sourceDocId: string;
  sectionId?: string | null;
  featureName?: string | null;
  featureVersion?: string | null;
  evidenceType?: string;
};

export class SignalRepository extends BaseRepository {
  public async upsertSignal(input: SignalInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO signal.signal
      (signal_id, instrument_id, trading_date, combined_alpha, risk_delta, pead_1d, pead_5d, model_version)
      VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
      ON CONFLICT(signal_id) DO UPDATE SET
        instrument_id = EXCLUDED.instrument_id,
        trading_date = EXCLUDED.trading_date,
        combined_alpha = EXCLUDED.combined_alpha,
        risk_delta = EXCLUDED.risk_delta,
        pead_1d = EXCLUDED.pead_1d,
        pead_5d = EXCLUDED.pead_5d,
        model_version = EXCLUDED.model_version
      `,
      [
        input.signalId,
        input.instrumentId,
        input.tradingDate,
        input.combinedAlpha,
        input.riskDelta,
        input.pead1d,
        input.pead5d,
        input.modelVersion ?? null,
      ],
    );
  }

  public async upsertSignalLineage(input: SignalLineageInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO signal.signal_lineage
      (signal_id, source_doc_id, section_id, feature_name, feature_version, evidence_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(signal_id, source_doc_id, section_id) DO UPDATE SET
        feature_name = EXCLUDED.feature_name,
        feature_version = EXCLUDED.feature_version,
        evidence_type = EXCLUDED.evidence_type
      `,
      [
        input.signalId,
        input.sourceDocId,
        input.sectionId ?? "",
        input.featureName ?? null,
        input.featureVersion ?? null,
        input.evidenceType ?? "DOCUMENT_SECTION",
      ],
    );
  }
}
