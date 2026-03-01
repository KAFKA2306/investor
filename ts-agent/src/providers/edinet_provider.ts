import { join } from "node:path";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { core } from "../system/app_runtime_core.ts";
import { SqliteHttpCache } from "./cache_providers.ts";

// ─── EDINET API Schemas ───────────────────────────────────────────────────
// https://api.edinet-fsa.go.jp

/**
 * 書類一覧APIレスポンス (documents.json)
 * Version 2: Subscription-Key 必須
 */
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
  // 有価証券報告書=030, 四半期報告書=043, 決算短信=140
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

/**
 * 書類取得APIのレスポンスタイプ
 * type=1: XBRL (ZIP), type=2: PDF, type=3: 代替書面, type=4: 英文XBRL, type=5: CSV
 */
export type EdinetDocumentType = 1 | 2 | 3 | 4 | 5;

export const EdinetDocumentTypeLabel: Record<EdinetDocumentType, string> = {
  1: "XBRL",
  2: "PDF",
  3: "代替書面・添付書類",
  4: "英文XBRL",
  5: "CSV",
};

// ─── Filter helpers ───────────────────────────────────────────────────────

/** 有価証券報告書 (Annual Securities Report) */
export const isAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "030";

/** 四半期報告書 (Quarterly Report) */
export const isQuarterlyReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "043";

/** 決算短信 (Earnings Report / Kessan Tanshin) */
export const isEarningsReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "140";

/** 半期報告書 (Semi-annual Report) */
export const isSemiAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "050";

/** 訂正有価証券報告書 (Amendment to Annual Report) */
export const isAmendedAnnualReport = (doc: EdinetDocument): boolean =>
  doc.docTypeCode === "030" && doc.parentDocID !== null;

/** Filter by security code (e.g. "65010" for 6501.T) */
export const bySecCode = (secCode: string) => (doc: EdinetDocument) =>
  doc.secCode === secCode;

/** Filter by EDINET code */
export const byEdinetCode = (edinetCode: string) => (doc: EdinetDocument) =>
  doc.edinetCode === edinetCode;

// ─── Provider ─────────────────────────────────────────────────────────────

export class EdinetProvider {
  private readonly baseUrl = "https://api.edinet-fsa.go.jp/api/v2";
  private readonly apiKey: string;
  private readonly cache: SqliteHttpCache;
  private readonly downloadDir: string;

  constructor(options?: { downloadDir?: string }) {
    if (!core.config.providers.edinet.enabled) {
      throw new Error("[EDINET] Provider is disabled in config.");
    }
    this.apiKey = core.getEnv("EDINET_API_KEY");
    this.cache = new SqliteHttpCache(
      join(core.config.paths.logs, "cache", "edinet_cache.sqlite"),
    );
    this.downloadDir =
      options?.downloadDir ??
      join(core.config.paths.logs, "cache", "edinet_docs");
    mkdirSync(this.downloadDir, { recursive: true });
  }

  // ─── 書類一覧 API ───────────────────────────────────────────────────

  /**
   * 指定日付の提出書類一覧を取得する (documents.json)
   * @param date - YYYY-MM-DD format
   * @param type - 1: メタデータのみ, 2: メタデータ+結果
   */
  public async getDocumentList(
    date: string,
    type: 1 | 2 = 2,
  ): Promise<EdinetDocumentListResponse> {
    const url = new URL(`${this.baseUrl}/documents.json`);
    url.searchParams.set("date", date);
    url.searchParams.set("type", String(type));
    url.searchParams.set("Subscription-Key", this.apiKey);

    console.log(`📡 [EDINET] Fetching document list for ${date}...`);

    // Past dates are immutable — cache permanently (100 years).
    // Today's data may still update — use 6h TTL.
    const todayStr = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    const isToday = date === todayStr;
    const cacheTtlMs = isToday
      ? 6 * 60 * 60 * 1000 // 6h for today
      : 100 * 365 * 24 * 60 * 60 * 1000; // permanent for past

    const { payload, cached } = await this.cache.fetchJson(
      url.toString(),
      {},
      cacheTtlMs,
    );

    if (cached) {
      // No delay needed for cache hits
    } else {
      await new Promise((r) => setTimeout(r, 200)); // Short delay for actual hits
    }

    // Be resilient: parse each item individually so one bad record doesn't skip the whole day
    const rawResults = (payload as any)?.results ?? [];
    const validResults: EdinetDocument[] = [];
    let errorCount = 0;

    for (const item of rawResults) {
      const parsedItem = EdinetDocumentSchema.safeParse(item);
      if (parsedItem.success) {
        validResults.push(parsedItem.data);
      } else {
        errorCount++;
        if (errorCount === 1) {
          console.warn(
            `⚠️ [EDINET] Item validation failed: ${parsedItem.error.message}`,
          );
        }
      }
    }

    if (errorCount > 0) {
      console.warn(
        `⚠️ [EDINET] Skipped ${errorCount} malformed documents for ${date}`,
      );
    }

    const metadata = (payload as any)?.metadata ?? {
      title: "EDINET API",
      parameter: { date, type: String(type) },
      resultset: { count: validResults.length },
      processDateTime: new Date().toISOString(),
      status: "200",
      message: "OK",
    };

    console.log(
      `✅ [EDINET] Found ${validResults.length} valid documents for ${date}`,
    );
    if (validResults.length > 0) {
      const sample = validResults
        .slice(0, 3)
        .map(
          (d) => `${d.docID}:${d.secCode}:${d.docDescription?.slice(0, 10)}`,
        );
      console.log(`🔍 [EDINET] Sample docs for ${date}: ${sample.join(", ")}`);
    }
    return { metadata, results: validResults };
  }

  /**
   * 指定日付の書類一覧から、特定の書類タイプでフィルタリング
   */
  public async getFilteredDocuments(
    date: string,
    filter: (doc: EdinetDocument) => boolean,
  ): Promise<EdinetDocument[]> {
    const response = await this.getDocumentList(date, 2);
    return response.results.filter(filter);
  }

  /**
   * 銘柄コードで指定日付の書類を検索
   * @param date - YYYY-MM-DD
   * @param secCode5 - 5桁証券コード (例: "65010")
   */
  public async getDocumentsBySecCode(
    date: string,
    secCode5: string,
  ): Promise<EdinetDocument[]> {
    return this.getFilteredDocuments(date, bySecCode(secCode5));
  }

  /**
   * 日付範囲で書類一覧を取得 (複数日をバッチ取得)
   */
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
      try {
        const response = await this.getDocumentList(dateStr, 2);
        const docs = filter
          ? response.results.filter(filter)
          : response.results;
        allDocs.push(...docs);
      } catch (e) {
        console.warn(`⚠️ [EDINET] Skipping ${dateStr}: ${e}`);
      }
    }

    console.log(
      `📊 [EDINET] Total ${allDocs.length} documents found in ${from}~${to}`,
    );
    return allDocs;
  }

  // ─── 書類取得 API ───────────────────────────────────────────────────

  /**
   * 書類ファイルをダウンロード (ZIP or PDF)
   *
   * EDINET の書類取得APIは成功時・失敗時とも HTTP 200 を返すため、
   * Content-Type で判定:
   *   - application/octet-stream → ZIP (成功)
   *   - application/json → エラーメッセージ
   *
   * @param docID - 書類管理番号
   * @param type  - 1:XBRL, 2:PDF, 3:代替書面, 4:英文XBRL, 5:CSV
   * @returns ダウンロードされたファイルのパス、またはnull (エラー時)
   */
  public async downloadDocument(
    docID: string,
    type: EdinetDocumentType = 1,
  ): Promise<string | null> {
    const typeLabel = EdinetDocumentTypeLabel[type];
    const fileName = `${docID}_type${type}.zip`;
    const filePath = join(this.downloadDir, fileName);

    // Check if already downloaded
    if (existsSync(filePath)) {
      console.log(`📁 [EDINET] Cache hit: ${fileName}`);
      return filePath;
    }

    const url = new URL(`${this.baseUrl}/documents/${docID}`);
    url.searchParams.set("type", String(type));
    url.searchParams.set("Subscription-Key", this.apiKey);

    console.log(`📥 [EDINET] Downloading ${typeLabel} for docID=${docID}...`);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(
          `❌ [EDINET] HTTP ${response.status}: ${response.statusText}`,
        );
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";

      // JSON response means error (EDINET returns 200 even on errors)
      if (contentType.includes("application/json")) {
        const errorBody = await response.json();
        console.error(`❌ [EDINET] API Error:`, JSON.stringify(errorBody));
        return null;
      }

      // Binary response = success (ZIP/PDF)
      if (
        contentType.includes("application/octet-stream") ||
        contentType.includes("application/pdf")
      ) {
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(filePath, buffer);
        console.log(
          `✅ [EDINET] Saved ${typeLabel}: ${filePath} (${buffer.length} bytes)`,
        );
        return filePath;
      }

      console.warn(`⚠️ [EDINET] Unexpected Content-Type: ${contentType}`);
      return null;
    } catch (e) {
      console.error(`❌ [EDINET] Download failed for ${docID}: ${e}`);
      return null;
    }
  }

  /**
   * 指定 docID の全タイプを一括ダウンロード
   */
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

  // ─── Convenience: 有価証券報告書 ─────────────────────────────────────

  /**
   * 指定日付の有価証券報告書を取得して XBRL + CSV をダウンロード
   */
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

  /**
   * 指定日付の決算短信を取得して CSV をダウンロード
   */
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

  // ─── Verification ───────────────────────────────────────────────────

  /**
   * API接続テスト用: 直近の書類一覧を取得して接続を確認
   */
  public async verify(): Promise<{
    documentsCount: number;
    status: "PASS" | "FAIL";
    reason?: string;
  }> {
    try {
      // Use yesterday to ensure data exists
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dateStr = yesterday.toISOString().slice(0, 10);
      const response = await this.getDocumentList(dateStr, 1);
      return {
        documentsCount: response.metadata.resultset.count,
        status: "PASS",
      };
    } catch (e) {
      return {
        status: "FAIL",
        documentsCount: 0,
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Cache-only lookup to find the latest date a ticker appeared in documents.json
   */
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
    try {
      const result = this.cache.db
        .query(sql)
        .get(`%"secCode":"${secCode5}"%`) as { date: string } | null;
      return result?.date ?? null;
    } catch (e) {
      console.warn(`⚠️ [EDINET] Cache search failed: ${e}`);
      return null;
    }
  }
}
