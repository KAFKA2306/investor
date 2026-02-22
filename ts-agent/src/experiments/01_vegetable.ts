import { z } from "zod";

const VegetableScenarioSchema = z.object({
  scenarioId: z.literal("SCN-VEG-001"),
  name: z.literal("Vegetable Inflation Rotation"),
  hypothesis: z.string(),
  dataSources: z.object({
    estat: z.object({
      indicator: z.literal("野菜価格指数"),
      appIdEnv: z.literal("ESTAT_APP_ID"),
    }),
    jquants: z.object({
      purpose: z.literal("野菜関連銘柄の価格/出来高確認"),
      apiKeyEnv: z.literal("JQUANTS_API_KEY"),
    }),
  }),
  universe: z.array(z.string()).min(1),
  entryRule: z.string(),
  exitRule: z.string(),
  riskRule: z.string(),
  expectedEdge: z.string(),
});

type VegetableScenario = z.infer<typeof VegetableScenarioSchema>;

export function defineVegetableScenario(): VegetableScenario {
  return VegetableScenarioSchema.parse({
    scenarioId: "SCN-VEG-001",
    name: "Vegetable Inflation Rotation",
    hypothesis:
      "野菜価格指数の上昇局面では、野菜流通・食品ディフェンシブ銘柄に短期の相対強さが出やすい。",
    dataSources: {
      estat: {
        indicator: "野菜価格指数",
        appIdEnv: "ESTAT_APP_ID",
      },
      jquants: {
        purpose: "野菜関連銘柄の価格/出来高確認",
        apiKeyEnv: "JQUANTS_API_KEY",
      },
    },
    universe: ["1375", "1332", "2503"],
    entryRule:
      "野菜価格指数の直近3か月前比が+5%超、かつ銘柄の20日移動平均を終値が上回る場合に買い。",
    exitRule: "10営業日経過、または終値が20日移動平均を下回った時点で手仕舞い。",
    riskRule: "1銘柄あたり最大1%リスク、ATR(14)の1.5倍で逆指値設定。",
    expectedEdge: "イベント起点の需給シフトを短期で取得する。",
  });
}

const runAsMain = import.meta.main;
runAsMain && console.log(JSON.stringify(defineVegetableScenario(), null, 2));
