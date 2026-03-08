import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 📈 マクロ経済のトップダウン分析を担当するエージェントだよっ！✨
 */
export class MacroTopDownAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "📈 [MacroTopDownAgent] Starting professional macro analysis...",
    );

    // 🎀 Twitter プロンプト 1 & 6 を基にした分析リクエストだよっ！
    const userPrompt = `
以下のマクロ経済分析を実行してください。

[1. マクロのトップダウン分析]
現在の主要な経済指標（インフレ、金利、GDP、雇用など）に基づき、現在のマクロ経済環境を分析してください。
このような環境で歴史的にアウトパフォームしてきたセクターや資産を特定してください。
さらに以下を提示してください：
• 類似する過去の事例を3つ
• 想定される投資期間
• 参考ソース3つ

[2. 危機時の相関マップ分析]
現在の市場において、金と株の同時上昇や、株と債券の同時下落など、通常とは異なる相関関係が発生していないか調査してください。
さらに以下を説明してください：
• その異常な相関が歴史的に何を示唆してきたか
• 相関が正常化すると利益が出るトレード案を3つ
• 情報ソース
`;

    const systemPrompt = `
You are a world-class Macro Strategist and Quant Analyst. 
Your goal is to provide deep, data-driven insights based on the provided parameters.
Use your knowledge of FRED, ECB, and other macro data sources to inform your analysis.
Respond in a structured, professional, yet insightful manner.
`;

    // 🚀 LLMに分析を依頼するよっ！
    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info(
      "✅ [MacroTopDownAgent] Macro analysis completed successfully!",
    );

    // 成果をログに出力して、イベントも発行しちゃうね 💖
    console.log(`\n${"=".repeat(50)}`);
    console.log("🌟 MACRO ANALYSIS REPORT 🌟");
    console.log("=".repeat(50));
    console.log(report);
    console.log(`${"=".repeat(50)}\n`);

    this.emitEvent("MACRO_ANALYSIS_GENERATED", {
      agent: "MacroTopDownAgent",
      summary: report.split("\n")[0] || "Macro environment analysis",
    });
  }
}
