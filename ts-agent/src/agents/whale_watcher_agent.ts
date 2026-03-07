import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 🐳 機関投資家のポジショニングを監視するエージェントだよっ！✨
 */
export class WhaleWatcherAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "🐳 [WhaleWatcherAgent] Starting institutional position analysis...",
    );

    // 🎀 Twitter プロンプト 8 を基にしたリクエストだよっ！
    const userPrompt = `
以下の機関投資家ポジション分析を実行してください。

[13F データおよび機関投資家の動き分析]
最新の13Fデータおよびニュースを使用して、トップ10のヘッジファンドが今四半期に「新規購入」「完全売却」「買い増し」した主要銘柄を抽出してください。
前四半期と比較してどのような変化があったかを分析してください。
分析結果には以下を含めてください：
• 銘柄（ティッカー）
• ファンド名
• 取引の内容（新規/売却/買い増し）
• 情報ソース（WhaleWisdom, Dataroma, SEC EDGARなど）
`;

    const systemPrompt = `
You are an expert in Institutional Ownership and 13F Analysis. 
Your task is to track the "smart money" and identify significant shifts in hedge fund portfolios.
Focus on identifying consensus trades among top-tier funds and high-conviction new entries.
Provide a clear comparison between the current and previous reporting periods.
`;

    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info("✅ [WhaleWatcherAgent] Institutional analysis completed!");

    console.log("\n" + "=".repeat(50));
    console.log("🐳 WHALE WATCHER REPORT 🐳");
    console.log("=".repeat(50));
    console.log(report);
    console.log("=".repeat(50) + "\n");

    this.emitEvent("INSTITUTIONAL_ANALYSIS_GENERATED", {
      agent: "WhaleWatcherAgent",
      summary:
        report.split("\n")[0] || "Institutional position shifts analysis",
    });
  }
}
