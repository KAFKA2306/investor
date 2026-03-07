import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 📈 統計的裁定と平均回帰（Mean Reversion）を担当するエージェントだよっ！✨
 */
export class MeanReversionAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "📈 [MeanReversionAgent] Searching for statistical arbitrage and mean reversion opportunities...",
    );

    // 🎀 Twitter プロンプト 2 を基にしたリクエストだよっ！
    const userPrompt = `
以下の平均回帰および統計的裁定分析を実行してください。

[1. 統計的裁定（ペアトレード）候補の探索]
同一セクター内で、歴史的に高い相関があるが、現在価格が大きく乖離しているペアを3つ特定してください。
各ペアについて以下を提示してください：
• 銘柄A vs 銘柄B
• 乖離の程度（Z-scoreなど）
• 乖離の想定原因
• 推奨されるロング/ショートの組み合わせ
• 利確・損切りの水準
• 情報ソース

[2. 売られすぎ・買われすぎの逆張り候補]
RSI、ボリンジャーバンド、または移動平均乖離率に基づき、極端な水準にあるがファンダメンタルズに崩れがない銘柄を5つ特定してください。
各銘柄について以下を提示してください：
• ティッカー、使用した指標、エントリーの根拠、想定される反発のターゲット、リスク要因、情報ソース
`;

    const systemPrompt = `
You are a Quantitative Analyst and Mean Reversion Specialist. 
Your expertise lies in identifying temporary price dislocations and statistical anomalies.
Focus on high-probability reversal setups and pairs trading opportunities where correlations are expected to mean-revert.
Be mathematically rigorous in your reasoning.
`;

    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info("✅ [MeanReversionAgent] Mean reversion analysis completed!");

    console.log("\n" + "=".repeat(50));
    console.log("📈 MEAN REVERSION REPORT 📈");
    console.log("=".repeat(50));
    console.log(report);
    console.log("=".repeat(50) + "\n");

    this.emitEvent("MEAN_REVERSION_ANALYSIS_GENERATED", {
      agent: "MeanReversionAgent",
      summary:
        report.split("\n")[0] || "Mean reversion and pairs trading analysis",
    });
  }
}
