import type {
  AceBullet,
  FactorGenerationOptions,
  StandardOutcome,
} from "../schemas/financial_domain_schemas.ts";
import { EvidenceSource } from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import type {
  AlphaFactor,
  BacktestResult,
  ComputeMarketData,
  ComputeResponse,
} from "../types/index.ts";
import {
  calculateAnnualizedReturn,
  calculatePValue,
  calculateSharpeRatio,
  calculateTStat,
} from "../utils/math_utils.ts";
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

  public async evaluateFactorsViaEngine(
    factors: AlphaFactor[],
    marketData: ComputeMarketData[],
    baselineScores?: number[],
  ): Promise<ComputeResponse> {
    const { ComputeEngineClient } = await import(
      "../providers/factor_compute_engine_client.ts"
    );
    const client = new ComputeEngineClient();
    const response = await client.evaluateFactors({
      factors: factors.map((factor) => ({
        id: factor.id,
        formula: factor.formula,
      })),
      market_data: marketData.map((row) => ({
        symbol: row.symbol,
        date: row.date,
        open: row.values.open ?? 0,
        high: row.values.high ?? 0,
        low: row.values.low ?? 0,
        close: row.values.close ?? 0,
        volume: row.values.volume ?? 0,
        turnover_value: row.values.turnover_value ?? 0,
        ...row.values,
      })),
      ...(baselineScores ? { baseline_scores: baselineScores } : {}),
    });

    return {
      results: (response.results ?? []).map((result) => ({
        id: result.factor_id,
        scores: result.scores ?? [],
      })),
    };
  }

  public calculateOutcome(
    strategyId: string,
    backtest?: BacktestResult,
    predictions?: number[],
    targets?: number[],
    experimentId?: string,
  ): StandardOutcome {
    if (!backtest?.history?.length) {
      throw new Error(
        `[AUDIT] Strategy ${strategyId} lacks backtest history. Fail Fast.`,
      );
    }
    if (!predictions || !targets || predictions.length !== targets.length) {
      throw new Error(
        `[AUDIT] Strategy ${strategyId} requires aligned predictions and targets.`,
      );
    }

    const tStat = calculateTStat(backtest.history);
    const pValue = calculatePValue(tStat, backtest.history.length);
    const sharpeRatio = calculateSharpeRatio(backtest.history);
    const annualizedReturn = calculateAnnualizedReturn(
      backtest.netReturn,
      backtest.tradingDays || 1,
    );

    let peak = 1;
    let nav = 1;
    let worstDrawdown = 0;
    for (const dailyReturn of backtest.history) {
      nav *= 1 + dailyReturn;
      peak = Math.max(peak, nav);
      worstDrawdown = Math.min(worstDrawdown, nav / peak - 1);
    }

    const directionalAccuracy =
      predictions.length === 0
        ? 0
        : predictions.reduce(
            (correct, prediction, index) =>
              correct +
              (Math.sign(prediction) === Math.sign(targets[index] ?? 0) ? 1 : 0),
            0,
          ) / predictions.length;

    return {
      strategyId,
      strategyName: "LES-Local-Seed-Framework",
      timestamp: new Date().toISOString(),
      experimentId,
      summary: `LES local seed evaluated against ${backtest.tradingDays} trading days of backtest evidence.`,
      evidenceSource: EvidenceSource.QUANT_BACKTEST,
      alpha: {
        tStat,
        pValue,
      },
      verification: {
        metrics: {
          mae: 0,
          rmse: 0,
          smape: 0,
          directionalAccuracy,
          sharpeRatio,
          annualizedReturn,
          maxDrawdown: Math.abs(worstDrawdown),
        },
        upliftOverBaseline: 0,
      },
      stability: {
        trackingError: Math.abs(tStat) * 0.001,
        tradingDaysHorizon: backtest.tradingDays,
        isProductionReady: false,
      },
    };
  }
}
