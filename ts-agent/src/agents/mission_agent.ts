import { writeFileSync } from "node:fs";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { paths } from "../system/path_registry.ts";

export interface MissionContext {
  currentRequirement?: string;
  historySeeds: string[];
  forbiddenZones: string[];
  constraints: string[];
  evaluationCriteria: Record<string, number>;
}

export class MissionAgent extends BaseAgent {
  public async generateNextMission(context: MissionContext): Promise<string> {
    console.log("🎯 [MissionAgent] Generating next autonomous mission...");

    const mission = `# Alpha Discovery Mission: ${context.currentRequirement || "Autonomous Evolution"} (Cycle ${Date.now() % 100})

## mission
${context.currentRequirement || "探索の継続的進化。マーケットの新しい非効率性を、既存の知識体系（Seeds）と制約事項（Forbidden）を考慮しながら発見せよ。"}

### 探索の重点
1. **Regime Neutrality**: 現在の相場レジームに依存しない、頑健なアルファの抽出。
2. **Orthogonality**: 既存のシード（${context.historySeeds.slice(0, 3).join(", ") || "None"}）と相関の低い因子の探索。

## constraints
- ターゲット銘柄: ${context.constraints.join(", ") || "6501.T, 9501.T, 6701.T"}
- 禁止領域: ${context.forbiddenZones.join(", ") || "Noise-heavy short-term momentum"}
- 納入条件: Sharpe Ratio > ${context.evaluationCriteria.minSharpe || 1.5}, IC > ${context.evaluationCriteria.minIC || 0.03}

## memory_context
- **シード**: ${context.historySeeds.join(", ")}
- **教訓**: 過去の失敗領域（${context.forbiddenZones.join(", ")}）を避け、経済的合理性の強い仮説を優先せよ。

## data_contract
- 必須項目: close, operating_profit, capital_expenditure
- 閾値: quality_score > 0.9

## evaluation_contract
- Sharpe Ratio: ${context.evaluationCriteria.minSharpe || 1.5}
- Information Coefficient: ${context.evaluationCriteria.minIC || 0.03}
- Max Drawdown: < 0.1

## return_path
- DATA_CAUSE: データ作成フェーズへ
- MODEL_CAUSE: モデル選定フェーズへ
`;

    writeFileSync(paths.missionMd, mission, "utf-8");
    console.log(`📝 [MissionAgent] Mission persisted to ${paths.missionMd}`);

    return mission;
  }

  public async run(): Promise<void> {
    console.log("🎯 MissionAgent is ready.");
  }
}
