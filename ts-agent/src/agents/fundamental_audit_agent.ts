import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { logger } from "../utils/logger.ts";

/**
 * 💸 ファンダメンタルズとセンチメントの監査を担当するエージェントだよっ！🧠
 */
export class FundamentalAuditAgent extends BaseAgent {
  private llm = new OpenAIThemeProvider();

  public async run(): Promise<void> {
    logger.info(
      "💸 [FundamentalAuditAgent] Starting fundamental & sentiment audit...",
    );

    // 🎀 Twitter プロンプト 5 & 7 を基にしたリクエストだよっ！
    const userPrompt = `
以下のファンダメンタル分析およびセンチメント監査を実行してください。

[1. センチメント vs ファンダメンタルズの歪み分析]
市場のセンチメント（ネガティブなニュースやSNSの弱気な雰囲気）が、強いファンダメンタルズと明らかに矛盾している銘柄を探してください。
6つのアイデアを提示し、各銘柄について以下を提示してください：
• ティッカー、ネガティブなセンチメントの理由、ファンダメンタルズがなぜ強いと言えるのか、テクニカルなエントリー水準、情報ソース

[2. 配当危険レーダー]
表面上は魅力的な高配当（5%以上）だが、以下のリスクがある企業を5社特定してください：
• 配当性向が高すぎる
• フリーキャッシュフローがマイナス
• 負債が増加している
各企業について以下を提示してください：
• ティッカー、現在の配当利回り、想定される減配確率、同じセクターのより安全な代替銘柄、情報ソース
`;

    const systemPrompt = `
You are a conservative Fundamental Researcher and Value Investor. 
Your goal is to find mispricings where sentiment is overly bearish despite strong financials, 
and to warn against "yield traps" where high dividends are unsustainable.
Be skeptical of surface-level data and focus on cash flows, debt levels, and long-term viability.
`;

    const report = await this.llm.chat(systemPrompt, userPrompt);

    logger.info("✅ [FundamentalAuditAgent] Audit completed successfully!");

    console.log(`\n${"=".repeat(50)}`);
    console.log("💸 FUNDAMENTAL AUDIT REPORT 💸");
    console.log("=".repeat(50));
    console.log(report);
    console.log(`${"=".repeat(50)}\n`);

    this.emitEvent("FUNDAMENTAL_AUDIT_GENERATED", {
      agent: "FundamentalAuditAgent",
      summary:
        report.split("\n")[0] || "Fundamental and sentiment audit report",
    });
  }
}
