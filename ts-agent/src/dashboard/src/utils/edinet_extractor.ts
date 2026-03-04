export interface EdinetKeyInsights {
  companyOverview: string;
  financialMetrics: string[];
  mainProducts: string[];
  risksAndChallenges: string[];
}

/**
 * EDINET 開示書類から重要部分を抽出する
 * 会社概要、財務指標、主要製品・サービス、リスク・課題を抽出
 */
export function extractKeyInsightsFromEdinetContent(
  content: string,
): EdinetKeyInsights {
  const result: EdinetKeyInsights = {
    companyOverview: "",
    financialMetrics: [],
    mainProducts: [],
    risksAndChallenges: [],
  };

  if (!content || content.trim().length === 0) {
    return result;
  }

  // Extract company overview (会社の概要 section)
  const overviewMatch = content.match(/【会社の概要】[\s\S]*?(?=【|$)/);
  if (overviewMatch) {
    result.companyOverview = overviewMatch[0]
      .replace(/【会社の概要】/, "")
      .trim()
      .split(/[\n。]/)[0]
      .trim();
  }

  // Extract financial metrics (主要な経営指標 section)
  const metricsMatch = content.match(/【主要な経営指標】[\s\S]*?(?=【|$)/);
  if (metricsMatch) {
    const metricsText = metricsMatch[0].replace(/【主要な経営指標】/, "");
    const lines = metricsText
      .split("\n")
      .filter((line) => line.includes("：") || line.match(/[0-9]/));
    result.financialMetrics = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // Extract main products/services (主要な製品・サービス section)
  const productsMatch = content.match(
    /【主要な製品・サービス】[\s\S]*?(?=【|$)/,
  );
  if (productsMatch) {
    const productsText = productsMatch[0].replace(
      /【主要な製品・サービス】/,
      "",
    );
    const items = productsText.split(/[\n、]/);
    result.mainProducts = items
      .map((item) => item.replace(/^\d+\.\s*/, "").trim())
      .filter((item) => item.length > 0);
  }

  // Extract risks and challenges (事業環境と課題 section)
  const risksMatch = content.match(/【事業環境と課題】[\s\S]*?(?=【|$)/);
  if (risksMatch) {
    const risksText = risksMatch[0].replace(/【事業環境と課題】/, "");
    const sentences = risksText
      .split(/[。\n]/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 10 &&
          (s.includes("課題") || s.includes("問題") || s.includes("リスク")),
      );
    result.risksAndChallenges = sentences.slice(0, 5); // Top 5 risks
  }

  return result;
}

/**
 * 複数の EDINET 文書から要点を統合
 */
export function mergeMultipleInsights(
  documents: EdinetKeyInsights[],
): EdinetKeyInsights {
  if (documents.length === 0) {
    return {
      companyOverview: "",
      financialMetrics: [],
      mainProducts: [],
      risksAndChallenges: [],
    };
  }

  return {
    companyOverview: documents[0]?.companyOverview || "",
    financialMetrics: [
      ...new Set(documents.flatMap((d) => d.financialMetrics)),
    ],
    mainProducts: [...new Set(documents.flatMap((d) => d.mainProducts))],
    risksAndChallenges: [
      ...new Set(documents.flatMap((d) => d.risksAndChallenges)),
    ],
  };
}
