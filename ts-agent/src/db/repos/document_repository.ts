import { BaseRepository } from "./base_repository.ts";

export type CanonicalDocumentInput = {
  documentId: string;
  sourceDocId: string;
  instrumentId: string | null;
  docType: string | null;
  filedAt: string | null;
  title: string;
};

export type CanonicalDocumentSectionInput = {
  sectionId: string;
  documentId: string;
  sectionName: string;
  content: string;
  sentiment: number;
  riskTermCount: number;
  aiTermCount: number;
};

export class DocumentRepository extends BaseRepository {
  public async upsertDocument(input: CanonicalDocumentInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO research.document
      (document_id, source_doc_id, instrument_id, doc_type, filed_at, title)
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6)
      ON CONFLICT(document_id) DO UPDATE SET
        source_doc_id = EXCLUDED.source_doc_id,
        instrument_id = EXCLUDED.instrument_id,
        doc_type = EXCLUDED.doc_type,
        filed_at = EXCLUDED.filed_at,
        title = EXCLUDED.title
      `,
      [
        input.documentId,
        input.sourceDocId,
        input.instrumentId,
        input.docType,
        input.filedAt,
        input.title,
      ],
    );
  }

  public async upsertSection(
    input: CanonicalDocumentSectionInput,
  ): Promise<void> {
    await this.db.query(
      `
      INSERT INTO research.document_section
      (section_id, document_id, section_name, content, sentiment, risk_term_count, ai_term_count, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT(section_id) DO UPDATE SET
        section_name = EXCLUDED.section_name,
        content = EXCLUDED.content,
        sentiment = EXCLUDED.sentiment,
        risk_term_count = EXCLUDED.risk_term_count,
        ai_term_count = EXCLUDED.ai_term_count,
        updated_at = NOW()
      `,
      [
        input.sectionId,
        input.documentId,
        input.sectionName,
        input.content,
        input.sentiment,
        input.riskTermCount,
        input.aiTermCount,
      ],
    );
  }
}
