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

export class SignalRepository extends BaseRepository<{ id: string }> {
  protected readonly table = "signal.signal";
  public async upsertSignal(input: SignalInput): Promise<void> {
    await this.executeUpsert({
      table: "signal.signal",
      conflictTarget: "signal_id",
      data: {
        signal_id: input.signalId,
        instrument_id: input.instrumentId,
        trading_date: input.tradingDate,
        combined_alpha: input.combinedAlpha,
        risk_delta: input.riskDelta,
        pead_1d: input.pead1d,
        pead_5d: input.pead5d,
        model_version: input.modelVersion ?? null,
      },
      casts: {
        trading_date: "date",
      },
    });
  }

  public async upsertSignalLineage(input: SignalLineageInput): Promise<void> {
    await this.executeUpsert({
      table: "signal.signal_lineage",
      conflictTarget: ["signal_id", "source_doc_id", "section_id"],
      data: {
        signal_id: input.signalId,
        source_doc_id: input.sourceDocId,
        section_id: input.sectionId ?? "",
        feature_name: input.featureName ?? null,
        feature_version: input.featureVersion ?? null,
        evidence_type: input.evidenceType ?? "DOCUMENT_SECTION",
      },
    });
  }
}
