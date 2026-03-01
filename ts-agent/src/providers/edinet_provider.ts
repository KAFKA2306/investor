import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./cache_providers.ts";
import { requestJson } from "./http_json_client.ts";
import { ProviderConfigError, ProviderHttpError } from "./provider_errors.ts";

export const EdinetDocumentSchema = z.object({
  docID: z.string(),
  secCode: z.string().nullable(),
  edinetCode: z.string().nullable(),
  filerName: z.string().nullable(),
  docDescription: z.string().nullable(),
  docTypeCode: z.string().nullable(),
  submitDateTime: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  parentDocID: z.string().nullable(),
  opeDateTime: z.string().nullable(),
  withdrawalStatus: z.string().nullable(),
  currentReportReason: z.string().nullable(),
});

export type EdinetDocument = z.infer<typeof EdinetDocumentSchema>;

export const EdinetDocumentListResponseSchema = z.object({
  metadata: z.object({
    title: z.string(),
    parameter: z.object({
      date: z.string(),
      type: z.string(),
    }),
    resultset: z.object({
      count: z.number().int(),
    }),
    processDateTime: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  results: z.array(EdinetDocumentSchema).default([]),
});

export type EdinetDocumentListResponse = z.infer<
  typeof EdinetDocumentListResponseSchema
>;

export type EdinetDocumentType = 1 | 2 | 3 | 4 | 5;

export const EdinetDocumentTypeLabel: Record<EdinetDocumentType, string> = {
  1: "XBRL",
  2: "PDF",
  3: "代替書面・添付書類",
  4: "英文XBRL",
  5: "CSV",
};

export const isAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "030";

export const isQuarterlyReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "043";

export const isEarningsReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "140";

export const isSemiAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "050";

export const isAmendedAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "030" && doc.parentDocID !== null;

export const bySecCode = (secCode: string) => (doc: EdinetDocument) =>
  doc.secCode === secCode;

export const byEdinetCode = (edinetCode: string) => (doc: EdinetDocument) =>
  doc.edinetCode === edinetCode;

export class EdinetProvider {
  private readonly baseUrl = "https://api.edinet-fsa.go.jp/api/v2";
  private readonly apiKey: string;
  private readonly cache: SqliteHttpCache;
  private readonly downloadDir: string;

  constructor(options?: { downloadDir?: string }) {
    if (!core.config.providers.edinet.enabled) {
      throw new ProviderConfigError("EDINET provider is disabled");
    }
    this.apiKey = core.getProviderCredential(
      "edinet",
      "apiKey",
      "EDINET_API_KEY",
    );
    this.cache = new SqliteHttpCache(
      join(core.config.paths.logs, "cache", "edinet_cache.sqlite"),
    );
    this.downloadDir =
      options?.downloadDir ??
      join(core.config.paths.logs, "cache", "edinet_docs");
    mkdirSync(this.downloadDir, { recursive: true });
  }

  public async getDocumentList(
    date: string,
    type: 1 | 2 = 2,
  ): Promise<EdinetDocumentListResponse> {
    const todayStr = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    const isToday = date === todayStr;
    const cacheTtlMs = isToday
      ? 6 * 60 * 60 * 1000
      : 100 * 365 * 24 * 60 * 60 * 1000;

    const res = await requestJson({
      baseUrl: this.baseUrl,
      endpoint: "/documents.json",
      query: {
        date,
        type: String(type),
        "Subscription-Key": this.apiKey,
      },
      cache: this.cache,
      ttlMs: cacheTtlMs,
    });

    if (!res.cached) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const payload = res.payload;
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const validResults: EdinetDocument[] = [];
    let errorCount = 0;

    for (const item of rawResults) {
      const parsedItem = EdinetDocumentSchema.safeParse(item);
      if (parsedItem.success) {
        validResults.push(parsedItem.data);
      } else {
        errorCount++;
      }
    }

    if (errorCount > 0) {
      console.warn(
        `⚠️ [EDINET] Skipped ${errorCount} malformed documents for ${date}`,
      );
    }

    const metadataCandidate = payload.metadata;
    const metadata =
      metadataCandidate &&
      typeof metadataCandidate === "object" &&
      !Array.isArray(metadataCandidate)
        ? (metadataCandidate as EdinetDocumentListResponse["metadata"])
        : {
            title: "EDINET API",
            parameter: { date, type: String(type) },
            resultset: { count: validResults.length },
            processDateTime: new Date().toISOString(),
            status: "200",
            message: "OK",
          };

    return { metadata, results: validResults };
  }

  public async getFilteredDocuments(
    date: string,
    filter: (doc: EdinetDocument) => boolean,
  ): Promise<EdinetDocument[]> {
    const response = await this.getDocumentList(date, 2);
    return response.results.filter(filter);
  }

  public async getDocumentsBySecCode(
    date: string,
    secCode5: string,
  ): Promise<EdinetDocument[]> {
    return this.getFilteredDocuments(date, bySecCode(secCode5));
  }

  public async getDocumentListRange(
    from: string,
    to: string,
    filter?: (doc: EdinetDocument) => boolean,
  ): Promise<EdinetDocument[]> {
    const startDate = new Date(from);
    const endDate = new Date(to);
    const allDocs: EdinetDocument[] = [];

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
      const response = await this.getDocumentList(dateStr, 2);
      const docs = filter ? response.results.filter(filter) : response.results;
      allDocs.push(...docs);
    }
    return allDocs;
  }

  public async downloadDocument(
    docID: string,
    type: EdinetDocumentType = 1,
  ): Promise<string | null> {
    const fileName = `${docID}_type${type}.zip`;
    const filePath = join(this.downloadDir, fileName);

    if (existsSync(filePath)) {
      return filePath;
    }

    const url = new URL(`${this.baseUrl}/documents/${docID}`);
    url.searchParams.set("type", String(type));
    url.searchParams.set("Subscription-Key", this.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new ProviderHttpError(
        response.status,
        url.toString(),
        response.statusText,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const errorBody = await response.json();
      console.error(`❌ [EDINET] API Error:`, JSON.stringify(errorBody));
      return null;
    }

    if (
      contentType.includes("application/octet-stream") ||
      contentType.includes("application/pdf")
    ) {
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(filePath, buffer);
      return filePath;
    }

    return null;
  }

  public async downloadAllTypes(
    docID: string,
  ): Promise<Record<EdinetDocumentType, string | null>> {
    const types: EdinetDocumentType[] = [1, 2, 5];
    const results: Record<number, string | null> = {};

    for (const t of types) {
      results[t] = await this.downloadDocument(docID, t);
      await new Promise((r) => setTimeout(r, 300));
    }

    return results as Record<EdinetDocumentType, string | null>;
  }

  public async fetchAnnualReports(
    date: string,
    secCode5?: string,
  ): Promise<
    { doc: EdinetDocument; xbrl: string | null; csv: string | null }[]
  > {
    let filter = isAnnualReport;
    if (secCode5) {
      filter = (doc) => isAnnualReport(doc) && bySecCode(secCode5)(doc);
    }

    const docs = await this.getFilteredDocuments(date, filter);
    const results: {
      doc: EdinetDocument;
      xbrl: string | null;
      csv: string | null;
    }[] = [];

    for (const doc of docs) {
      const xbrl = await this.downloadDocument(doc.docID, 1);
      const csv = await this.downloadDocument(doc.docID, 5);
      results.push({ doc, xbrl, csv });
      await new Promise((r) => setTimeout(r, 300));
    }

    return results;
  }

  public async fetchEarningsReports(
    date: string,
    secCode5?: string,
  ): Promise<{ doc: EdinetDocument; csv: string | null }[]> {
    let filter = isEarningsReport;
    if (secCode5) {
      filter = (doc) => isEarningsReport(doc) && bySecCode(secCode5)(doc);
    }

    const docs = await this.getFilteredDocuments(date, filter);
    const results: { doc: EdinetDocument; csv: string | null }[] = [];

    for (const doc of docs) {
      const csv = await this.downloadDocument(doc.docID, 5);
      results.push({ doc, csv });
      await new Promise((r) => setTimeout(r, 300));
    }

    return results;
  }

  public async verify(): Promise<{
    documentsCount: number;
    status: "PASS" | "FAIL";
    reason?: string;
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const response = await this.getDocumentList(dateStr, 1);
    return {
      documentsCount: response.metadata.resultset.count,
      status: "PASS",
    };
  }

  public async findLatestReportDateInCache(
    secCode5: string,
    docTypeCode?: string,
  ): Promise<string | null> {
    const typeFilter = docTypeCode
      ? `AND value LIKE '%"docTypeCode":"${docTypeCode}"%'`
      : "";
    const sql = `
            SELECT 
                SUBSTR(json_extract(key, '$.url'), INSTR(json_extract(key, '$.url'), 'date=') + 5, 10) as date
            FROM http_cache
            WHERE json_extract(key, '$.url') LIKE '%documents.json%'
              AND value LIKE ?
              ${typeFilter}
            ORDER BY date DESC
            LIMIT 1
        `;
    const result = this.cache.db
      .query(sql)
      .get(`%"secCode":"${secCode5}"%`) as { date: string } | null;
    return result?.date ?? null;
  }
}
