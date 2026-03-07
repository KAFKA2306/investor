import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 🛡️ ポートフォリオのヘッジ戦略を設計するエージェントだよっ！✨
 */
export class RiskHedgingAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "🛡️ [RiskHedgingAgent] Starting risk hedging strategy design...",
    );

    const nlInput = this.readNaturalLanguageInput();
    const portfolioContext =
      nlInput.text || "a diversified Japanese equity portfolio with tech bias";

    // 🎀 Twitter プロンプト 9 を基にしたリクエストだよっ！
    const userPrompt = `
以下のポートフォリオ・ヘッジ戦略を設計してください。

[ポートフォリオ構成の前提]
${portfolioContext}

[ヘッジ戦略の設計]
現在のオプションデータ、ボラティリティ指標、およびインバースETFの状況を考慮し、上記ポートフォリオのための効率的なヘッジ戦略を提案してください。
提案には以下を含めてください：
• 推奨されるヘッジ手段（プットオプション、インバースETF、ボラティリティ商品など）
• ヘッジサイズ（ポートフォリオ全体に対する比率）
• 想定される年間ヘッジコスト（ポジション維持費用）
• どのような市場状況やシグナルでヘッジを発動・強化すべきか
• ボラティリティデータおよびヘッジ手段の情報ソース
`;

    const systemPrompt = `
You are a conservative Risk Manager and Derivatives Strategist. 
Your goal is to design cost-effective hedging strategies to protect portfolios from tail risks and significant drawdowns.
Balance the cost of hedging against the level of protection provided.
Be specific about instrument types and execution triggers.
`;

    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info(
      "✅ [RiskHedgingAgent] Hedging strategy designed successfully!",
    );

    console.log("\n" + "=".repeat(50));
    console.log("🛡️ RISK HEDGING STRATEGY 🛡️");
    console.log("=".repeat(50));
    console.log(report);
    console.log("=".repeat(50) + "\n");

    this.emitEvent("HEDGING_STRATEGY_GENERATED", {
      agent: "RiskHedgingAgent",
      summary: report.split("\n")[0] || "Portfolio hedging strategy design",
    });
  }
}
