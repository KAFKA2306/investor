import { BaseAgent } from "./system/app_runtime_core.ts";
import "./skills/finance/statistics.ts"; // スキルを読み込んで登録！

class TestAgent extends BaseAgent {
  public async run(): Promise<void> {
    console.log("🔍 Testing Skills...");

    // スキル一覧を表示してみるよ！
    const skills = await this.listAvailableSkills();
    console.log("Available Skills:", skills);

    // Sharpe比の計算テストだよ！📈
    const returns = [0.01, -0.005, 0.02, 0.015, -0.01];
    const sharpe = await this.useSkill("calculate_sharpe", { returns });
    console.log(`✅ Sharpe Ratio calculated: ${sharpe}`);

    // T統計量の計算テストだよ！🔍
    const tStat = await this.useSkill("calculate_t_stat", { returns });
    console.log(`✅ T-Stat calculated: ${tStat}`);
  }
}

async function main() {
  const agent = new TestAgent();
  await agent.run();
}

main().catch(console.error);
