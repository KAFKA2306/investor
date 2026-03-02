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

export class DocumentRepository extends BaseRepository<{ id: string }> {
  protected readonly table = "research.document";
  public async upsertDocument(input: CanonicalDocumentInput): Promise<void> {
    await this.executeUpsert({
      table: "research.document",
      conflictTarget: "document_id",
      data: {
        document_id: input.documentId,
        source_doc_id: input.sourceDocId,
        instrument_id: input.instrumentId,
        doc_type: input.docType,
        filed_at: input.filedAt,
        title: input.title,
      },
      casts: {
        filed_at: "timestamptz",
      },
    });
  }

  public async upsertSection(
    input: CanonicalDocumentSectionInput,
  ): Promise<void> {
    await this.executeUpsert({
      table: "research.document_section",
      conflictTarget: "section_id",
      data: {
        section_id: input.sectionId,
        document_id: input.documentId,
        section_name: input.sectionName,
        content: input.content,
        sentiment: input.sentiment,
        risk_term_count: input.riskTermCount,
        ai_term_count: input.aiTermCount,
        updated_at: "NOW()", // 注意: NOW() は文字列として渡すとプレースホルダーに入っちゃうので、executeUpsert の改善が必要かも
      },
    });
  }
}
