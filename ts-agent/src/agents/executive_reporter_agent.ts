import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 🎁 投資家向けのエグゼクティブ・レポーティングを担当するエージェントだよっ！🌈
 */
export class ExecutiveReporterAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "🎁 [ExecutiveReporterAgent] Generating weekly executive briefing...",
    );

    // 🎀 Twitter プロンプト 10 を基にしたリクエストだよっ！
    const userPrompt = `
以下のエグゼクティブ・ブリーフィング（週報形式）を生成してください。

[1. 今週の重要マクロイベント]
今週予定されている、市場に大きな影響を与える可能性のあるマクロイベントを3つ特定し、その重要性と注目ポイントを説明してください。

[2. 注目決算（予想付き）]
今週決算発表を控えている主要企業の中から、特に市場の関心が高いものをピックアップし、市場予想（EPS/売上高）を提示してください。

[3. セクター別資金流向]
直近で資金流入が最も大きい（または勢いのある）セクターを特定し、その理由を簡潔に述べてください。

[4. 投資アイデア（ロング＆ショート）]
今週のベスト・ロングアイデア1つと、ベスト・ショートアイデア1つを、具体的な注目価格水準（エントリー/利確/損切り）とともに提示してください。

[5. 今週のメインリスク]
今週特に注意すべき市場リスクやボラティリティの要因を1つ特定し、その影響を説明してください。

[形式要求]
• 1ページのエグゼクティブブリーフィング形式でまとめてください。
• すべての情報ソースのリンク（または名称）を明記してください。
`;

    const systemPrompt = `
You are a Chief Investment Officer (CIO) preparing a weekly briefing for high-net-worth clients and portfolio managers. 
Your tone is authoritative, concise, and highly actionable.
Synthesize data from all available market sources to provide a high-level strategic overview.
Ensure that your long/short ideas represent high-conviction opportunities.
`;

    try {
      const report = await this.llm.chat(systemPrompt, userPrompt);

      logger.info(
        "✅ [ExecutiveReporterAgent] Executive report generated successfully!",
      );

      console.log("\n" + "=".repeat(60));
      console.log("🎁 WEEKLY EXECUTIVE BRIEFING 🎁");
      console.log("=".repeat(60));
      console.log(report);
      console.log("=".repeat(60) + "\n");

      this.emitEvent("EXECUTIVE_REPORT_GENERATED", {
        agent: "ExecutiveReporterAgent",
        summary: "Weekly comprehensive market briefing",
      });
    } catch (error) {
      logger.error(
        `❌ [ExecutiveReporterAgent] Report generation failed: ${String(error)}`,
      );
      throw error;
    }
  }
}
