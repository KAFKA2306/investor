import type {
  AceBullet,
  FactorGenerationOptions,
} from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import type { AlphaFactor } from "../types/index.ts";
import { PromptFactory } from "./prompt_factory.ts";

const LOCAL_SEEDS = [
  {
    formula: "($close-Mean($close,5))/Std($close,5)",
    features: ["close"],
  },
  {
    formula: "($volume-Mean($volume,10))/Std($volume,10)",
    features: ["volume"],
  },
  {
    formula: "$close/Ref($close,5)-1",
    features: ["close"],
  },
] as const;

export class LesAgent extends BaseAgent {
  public async run(): Promise<void> {
    await this.generateAlphaFactors([], { count: 3 });
  }

  public async generateAlphaFactors(
    playbookBullets: AceBullet[] = [],
    options: FactorGenerationOptions = {},
  ): Promise<AlphaFactor[]> {
    const forbiddenThemes = new Set(
      playbookBullets
        .filter(
          (bullet) =>
            bullet.section === "strategies_and_hard_rules" &&
            bullet.metadata?.status === "REJECTED",
        )
        .map((bullet) => bullet.content.split(":", 1)[0]?.trim().toLowerCase())
        .filter((theme): theme is string => Boolean(theme)),
    );

    const availableThemes = PromptFactory.BASE_THEMES.filter(
      (theme) => !forbiddenThemes.has(theme.name.toLowerCase()),
    );
    const count = Math.max(1, options.count ?? 2);

    return Array.from({ length: count }, (_, index) => {
      const theme =
        availableThemes[index % availableThemes.length] ??
        PromptFactory.BASE_THEMES[index % PromptFactory.BASE_THEMES.length]!;
      const seed = LOCAL_SEEDS[index % LOCAL_SEEDS.length]!;

      return {
        id: `les-local-${index + 1}`,
        formula: seed.formula,
        description: `Local seed candidate: ${theme.name}`,
        reasoning:
          "Deterministic local seed. It must pass downstream validation before adoption.",
        generation: 0,
        mutationType: "NEW_SEED",
        gender: index % 2 === 0 ? "MALE" : "FEMALE",
        featureSignature: [...seed.features],
        themeSource: "LOCAL",
      } satisfies AlphaFactor;
    });
  }
}
