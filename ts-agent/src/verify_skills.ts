import { BaseAgent } from "./system/app_runtime_core.ts";
import "./skills/finance/statistics.ts"; // 既存スキル: Sharpe, T-Stat
import "./skills/finance/risk_metrics.ts"; // 新規: MaxDrawdown, Sortino, Calmar, IC
import "./skills/finance/factor_utils.ts"; // 新規: Winsorize, Normalize, GaussRank
import "./skills/finance/signal_quality.ts"; // 新規: RollingIC, ICIR, HitRate

class TestAgent extends BaseAgent {
  public async run(): Promise<void> {
    console.log("🔍 Testing Skills...");

    // スキル一覧を表示してみるよ！
    const skills = await this.listAvailableSkills();
    console.log("Available Skills:", skills);
    console.log(`\n✨ Total skills registered: ${skills.length}\n`);

    const returns = [0.01, -0.005, 0.02, 0.015, -0.01];
    const factorValues = [0.5, -0.3, 0.8, 0.2, -0.1];
    const forwardReturns = [0.01, -0.005, 0.02, 0.015, -0.01];

    // === 既存スキル ===
    console.log("📈 === Existing Skills ===");
    const [sharpe, tStat] = await Promise.all([
      this.useSkill("calculate_sharpe", { returns }),
      this.useSkill("calculate_t_stat", { returns }),
    ]);
    console.log(`✅ Sharpe Ratio: ${sharpe}`);
    console.log(`✅ T-Stat: ${tStat}`);

    // === リスク指標スキル ===
    console.log("\n📊 === Risk Metrics Skills ===");
    const [maxDD, sortino, calmar, ic] = await Promise.all([
      this.useSkill("calculate_max_drawdown", { returns }),
      this.useSkill("calculate_sortino", { returns }),
      this.useSkill("calculate_calmar", { returns, days: 252 }),
      this.useSkill("calculate_ic", { factorValues, forwardReturns }),
    ]);
    console.log(`✅ Max Drawdown: ${maxDD}`);
    console.log(`✅ Sortino Ratio: ${sortino}`);
    console.log(`✅ Calmar Ratio: ${calmar}`);
    console.log(`✅ Information Coefficient: ${ic}`);

    // === ファクター前処理スキル ===
    console.log("\n🔄 === Factor Utils Skills ===");
    const [winsored, normalized, gaussRanked] = await Promise.all([
      this.useSkill("winsorize_factor", {
        values: factorValues,
        lowerPct: 0.01,
        upperPct: 0.99,
      }),
      this.useSkill("normalize_factor", { values: factorValues }),
      this.useSkill("gauss_rank_factor", { values: factorValues }),
    ]);
    console.log(`✅ Winsorized: ${winsored}`);
    console.log(`✅ Normalized (Z-score): ${normalized}`);
    console.log(`✅ Gauss Ranked: ${gaussRanked}`);

    // === シグナル品質スキル ===
    console.log("\n📡 === Signal Quality Skills ===");
    const hitRate = await this.useSkill("calculate_hit_rate", {
      factorSeries: factorValues,
      returnSeries: forwardReturns,
    });
    console.log(`✅ Hit Rate: ${hitRate}`);

    console.log("\n✨ All skills tested successfully!");
  }
}

async function main() {
  const agent = new TestAgent();
  await agent.run();
}

main().catch(console.error);
