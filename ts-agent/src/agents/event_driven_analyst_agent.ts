import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 🔥 イベント駆動型の分析を担当するエージェントだよっ！🕵️‍♀️
 */
export class EventDrivenAnalystAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "🔥 [EventDrivenAnalystAgent] Starting event-driven alpha search...",
    );

    // 🎀 Twitter プロンプト 3 & 4 を基にしたリクエストだよっ！
    const userPrompt = `
以下のイベント駆動型分析を実行してください。

[1. ショートスクイーズ候補のスクリーニング]
最新の市場データやニュースを調査し、以下の条件を満たすショートスクイーズ候補を5つ特定してください：
• 空売り比率が高い（浮動株の20%以上）
• 借株金利が高い（可能であれば）
• 近いうちに材料（カタリスト）がある
各銘柄について以下を提示してください：
• ティッカー、空売り比率、Days to Cover、注目のカタリスト、推奨エントリー戦略、失敗リスク、情報ソース

[2. M&Aレーダー]
最新の金融ニュースやSECフィリング（8-Kなど）を調査し、買収の噂がある、または買収される可能性が高い企業を5社特定してください。
各企業について以下を提示してください：
• ティッカー、想定される買収企業、過去の同業種買収プレミアム、規制リスク、情報ソース2つ
`;

    const systemPrompt = `
You are a highly skilled Event-Driven Trader and Analyst. 
Focus on identifying high-probability catalysts such as short squeezes and M&A activities.
Synthesize information from news sentiments, short interest data, and corporate filings.
Be precise with tickers and data points.
`;

    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info("✅ [EventDrivenAnalystAgent] Event analysis completed!");

    console.log("\n" + "=".repeat(50));
    console.log("🔥 EVENT-DRIVEN REPORT 🔥");
    console.log("=".repeat(50));
    console.log(report);
    console.log("=".repeat(50) + "\n");

    this.emitEvent("EVENT_ANALYSIS_GENERATED", {
      agent: "EventDrivenAnalystAgent",
      summary: report.split("\n")[0] || "Event-driven opportunities analysis",
    });
  }
}
