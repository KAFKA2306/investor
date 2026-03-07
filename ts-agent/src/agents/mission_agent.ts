import { writeFileSync } from "node:fs";
import { DEFAULT_EVALUATION_CRITERIA } from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { paths } from "../system/path_registry.ts";

export interface MissionContext {
  currentRequirement?: string;
  historySeeds: string[];
  forbiddenZones: string[];
  constraints: string[];
  evaluationCriteria: Record<string, number>;
}

export interface PivotDomainInput {
  reason: string;
  count: number;
  currentForbiddenZones: string[];
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
- 納入条件: Sharpe Ratio > ${context.evaluationCriteria.minSharpe || DEFAULT_EVALUATION_CRITERIA.performance.minSharpe}, P-Value < ${context.evaluationCriteria.maxPValue || DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue}
...
## evaluation_contract
- Sharpe Ratio: ${context.evaluationCriteria.minSharpe || DEFAULT_EVALUATION_CRITERIA.performance.minSharpe}
- P-Value: ${context.evaluationCriteria.maxPValue || DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue}
- Max Drawdown: < 0.1

## return_path
- DATA_CAUSE: データ作成フェーズへ
- MODEL_CAUSE: モデル選定フェーズへ
`;

    writeFileSync(paths.missionMd, mission, "utf-8");
    console.log(`📝 [MissionAgent] Mission persisted to ${paths.missionMd}`);

    return mission;
  }

  /**
   * 📌 Ralph Loop: 連続失敗時にドメインを転換 (Pivot) するよっ！ 🔄
   */
  public async pivotDomain(input: PivotDomainInput): Promise<void> {
    console.log(
      `🔄 [MissionAgent] Pivoting domain due to ${input.reason} (${input.count} failures)`,
    );

    // 新しいドメインの方向性を決めるよっ！ 🧭
    // 今はシンプルに「禁止区域を考慮して逆の視点を持つ」指示を出すねっ ✨
    const newFocus =
      input.currentForbiddenZones.length > 0
        ? `Avoid these failed zones: ${input.currentForbiddenZones.join(", ")}. Instead, explore orthogonal market dynamics or un-exploited data layers.`
        : "Market regime shift detected. Reinvent alpha hypothesis from fundamental micro-structure.";

    const mission = `# 🔄 RALPH LOOP PIVOT MISSION: ${Date.now()}
    
## mission
${newFocus}
過去の失敗に囚われず、全く新しい視点からアルファを探し出すんだもんっ！ 🚀💎

### 転換のトリガー
- 理由: ${input.reason}
- 連続失敗回数: ${input.count}

### 🔄 次の探索方針
1. **Un-explored Data**: 既存の ${input.currentForbiddenZones.join(", ") || "Known"} 以外のデータ項目を優先して使うこと。
2. **Reverse Hypothesis**: 過去の失敗が「順張り」だったなら「逆張り」を、「短期」だったなら「中期」を試してみてっ 📈

## constraints
- 探索宇宙: Japan-A-Universe (Expanded)
- 禁止領域: ${input.currentForbiddenZones.join(", ") || "None"}
- 緩和ルール: 最初の一サイクルは Sharpe > 1.2 でも HOLD として許容するよっ 🛡️✨

## evaluation_contract
- Sharpe Ratio Target: 1.8 (Soft limit for exploration: 1.2)
- P-Value Target: 0.05
- Max Drawdown: < 0.12
`;

    writeFileSync(paths.missionMd, mission, "utf-8");
    console.log(
      `📝 [MissionAgent] Pivot Mission persisted to ${paths.missionMd}`,
    );

    this.emitEvent("DOMAIN_PIVOTED", {
      reason: input.reason,
      count: input.count,
      newFocus: newFocus,
    });
  }

  public async run(): Promise<void> {
    const nl = this.readNaturalLanguageInput();
    const mission = await this.generateNextMission({
      currentRequirement: nl.text || undefined,
      historySeeds: [],
      forbiddenZones: [],
      constraints: [],
      evaluationCriteria: {
        minSharpe: DEFAULT_EVALUATION_CRITERIA.performance.minSharpe,
        maxPValue: DEFAULT_EVALUATION_CRITERIA.alpha.maxPValue,
      },
    });
    console.log(
      `🎯 [MissionAgent] Mission Cycle Started: ${mission.slice(0, 50)}...`,
    );
  }
}
