import { describe, it, expect } from "bun:test";
import { extractKeyInsightsFromEdinetContent } from "../../src/dashboard/src/utils/edinet_extractor";

describe("EDINET Content Extraction", () => {
  const mockEdinetContent = `
    【会社の概要】
    当社は、日本を代表するテクノロジー企業として、AI・クラウド・半導体などの最先端技術を開発しています。

    【主要な経営指標】
    売上高：¥1,234,567百万
    営業利益：¥567,890百万
    営業利益率：46.0%

    【主要な製品・サービス】
    1. AI プラットフォーム
    2. クラウドソリューション
    3. 次世代チップセット

    【事業環境と課題】
    デジタルトランスフォーメーション需要の拡大に伴い、当社の製品需要が増加しています。
    一方で、サプライチェーン管理が重要な課題となっています。
  `;

  it("should extract company overview from EDINET content", () => {
    const result = extractKeyInsightsFromEdinetContent(mockEdinetContent);

    expect(result.companyOverview).toBeDefined();
    expect(result.companyOverview).toMatch(/テクノロジー企業/);
    expect(result.companyOverview).toMatch(/AI・クラウド・半導体/);
  });

  it("should extract financial metrics", () => {
    const result = extractKeyInsightsFromEdinetContent(mockEdinetContent);

    expect(result.financialMetrics).toBeDefined();
    expect(result.financialMetrics.length).toBeGreaterThan(0);
    expect(result.financialMetrics.some((m) => m.includes("売上高"))).toBe(true);
    expect(result.financialMetrics.some((m) => m.includes("営業利益率"))).toBe(
      true,
    );
  });

  it("should extract main products/services", () => {
    const result = extractKeyInsightsFromEdinetContent(mockEdinetContent);

    expect(result.mainProducts).toBeDefined();
    expect(result.mainProducts.length).toBeGreaterThanOrEqual(3);
    expect(result.mainProducts.some((p) => p.includes("AI"))).toBe(true);
  });

  it("should extract business risks and challenges", () => {
    const result = extractKeyInsightsFromEdinetContent(mockEdinetContent);

    expect(result.risksAndChallenges).toBeDefined();
    expect(result.risksAndChallenges.length).toBeGreaterThan(0);
    expect(result.risksAndChallenges[0]).toMatch(/サプライチェーン/);
  });

  it("should return structured format with all keys", () => {
    const result = extractKeyInsightsFromEdinetContent(mockEdinetContent);

    expect(result).toHaveProperty("companyOverview");
    expect(result).toHaveProperty("financialMetrics");
    expect(result).toHaveProperty("mainProducts");
    expect(result).toHaveProperty("risksAndChallenges");
  });

  it("should handle empty or malformed content gracefully", () => {
    const result = extractKeyInsightsFromEdinetContent("");

    expect(result.companyOverview).toBe("");
    expect(result.financialMetrics).toStrictEqual([]);
    expect(result.mainProducts).toStrictEqual([]);
    expect(result.risksAndChallenges).toStrictEqual([]);
  });
});
