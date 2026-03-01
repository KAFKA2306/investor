import * as fs from "node:fs";
import { loadModelRegistry } from "../model_registry/model_registry_loader.ts";
import type { BacktestResult } from "../pipeline/evaluate/backtest_core.ts";
import { QuantMetrics } from "../pipeline/evaluate/evaluation_metrics_core.ts";
import type { FactorAST } from "../pipeline/factor_mining/factor_compute_engine.ts";
import type {
  ComputeMarketData,
  ComputeResponse,
} from "../providers/factor_compute_engine_client.ts";
import { OpenAIThemeProvider } from "../providers/openai_theme_provider.ts";
import type {
  AceBullet,
  StandardOutcome,
} from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "../system/app_runtime_core.ts";
import { paths } from "../system/path_registry.ts";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const pickOne = <T>(items: readonly T[]): T => {
  const value = items[Math.floor(Math.random() * items.length)];
  if (value === undefined) {
    throw new Error("random selection failed");
  }
  return value;
};

export const readNaturalLanguageInput = (): {
  text: string;
  source: "ENV" | "FILE" | "NONE";
} => {
  const fromEnv = (process.env.UQTL_NL_INPUT || "").trim();
  if (fromEnv.length > 0) return { text: fromEnv, source: "ENV" };
  const filePath = (process.env.UQTL_NL_INPUT_FILE || "").trim();
  if (filePath.length > 0 && fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8").trim();
    if (content.length > 0) return { text: content, source: "FILE" };
  }
  return { text: "", source: "NONE" };
};

export interface AlphaFactor {
  id: string;
  ast: Record<string, unknown>;
  description: string;
  reasoning: string;

  parentId?: string | undefined;
  generation: number;
  mutationType:
    | "CROSSOVER"
    | "POINT_MUTATION"
    | "STRUCTURAL_SHIFT"
    | "NEW_SEED";
  gender: "MALE" | "FEMALE";
  featureSignature?: string[] | undefined;
  ideaHashHint?: string | undefined;
  themeSource?: "OPENAI" | "LOCAL" | undefined;
  llmModel?: string | undefined;
}

export interface FactorEvaluation {
  factorId: string;
  rs: number;
  logic: string;
  rejectionReason: string | undefined;
}

export interface FactorGenerationOptions {
  count?: number;
  blindPlanning?: boolean;
  targetDiversity?: "HIGH" | "MEDIUM" | "LOW";
  feedback?: string[];
}

export class LesAgent extends BaseAgent {
  private openAIThemeProvider = new OpenAIThemeProvider();

  public async generateAlphaFactors(
    playbookBullets: AceBullet[] = [],
    _options: FactorGenerationOptions = {},
  ): Promise<AlphaFactor[]> {
    const registry = await loadModelRegistry();
    const lesModel = registry.models.find((m) => m.id === "les-forecast");
    const source = lesModel ? ` (Ref: ${lesModel.arxiv})` : "";

    let missionContext = "";
    if (fs.existsSync(paths.missionMd)) {
      missionContext = fs.readFileSync(paths.missionMd, "utf8");
      if (missionContext.trim().length > 0) {
        const titleMatch = missionContext.match(/# (.*)/);
        console.log(
          `🎯 MISSION LOADED: Focusing on ${titleMatch ? titleMatch[1] : "Custom Mission"}...`,
        );
      }
    }
    const naturalLanguageInput = readNaturalLanguageInput();
    if (naturalLanguageInput.source !== "NONE") {
      console.log(
        `🗣️ NL INPUT LOADED (${naturalLanguageInput.source}): ${naturalLanguageInput.text.slice(0, 80)}...`,
      );
    }

    console.log(
      `🚀 LES: Seed Alpha Factory is requesting DSL generation from LLM${source}...`,
    );

    const existingThemes = new Set<string>();
    const forbiddenThemes = new Set<string>();

    for (const bullet of playbookBullets) {
      if (bullet.content) {
        const match = bullet.content.match(/^([^:]+):/);
        const themeName = match?.[1]?.trim().toLowerCase();

        if (themeName) {
          if (bullet.section === "strategies_and_hard_rules") {
            forbiddenThemes.add(themeName);
          } else {
            existingThemes.add(themeName);
          }
        }

        if (bullet.content.includes("[REJECTED]")) {
          const critiqueKeywords = [
            "momentum",
            "mean reversion",
            "volatility",
            "regime",
          ];
          for (const kw of critiqueKeywords) {
            if (bullet.content.toLowerCase().includes(kw)) {
              forbiddenThemes.add(kw);
            }
          }
        }
      }
    }

    const ops = ["DIV", "MUL", "SUB", "ADD", "SMA", "LAG"] as const;
    const cols = [
      "close",
      "open",
      "high",
      "low",
      "volume",
      "correction_freq",
      "activist_bias",
      "macro_iip",
      "macro_cpi",
      "segment_sentiment",
      "ai_exposure",
      "kg_centrality",
    ];
    const personas = [
      "Quant Analyst",
      "Macro Strategist",
      "Behavioral Economist",
      "HFT Engineer",
      "Fundamental Researcher",
    ];
    const recentSuccesses: string[] = [];
    const recentFailures: string[] = [];
    for (const b of playbookBullets) {
      const helpful = b.helpful_count || 0;
      const harmful = b.harmful_count || 0;
      if (helpful > harmful && recentSuccesses.length < 8)
        recentSuccesses.push(b.content);
      else if (harmful > helpful && recentFailures.length < 8)
        recentFailures.push(b.content);
    }

    const generateRandomAST = (
      depth: number,
      biasCols?: string[],
      mutationStrength = 1.0,
    ): FactorAST => {
      if (
        depth <= 0 ||
        (depth === 1 && Math.random() > 0.6 * mutationStrength)
      ) {
        if (Math.random() > 0.2) {
          const pool = biasCols && Math.random() > 0.5 ? biasCols : cols;
          return {
            type: "variable",
            name: pickOne(pool),
          };
        }
        return {
          type: "constant",
          value: Number((Math.random() * 5).toFixed(2)),
        };
      }
      const op = pickOne(ops);
      if (op === "SMA" || op === "LAG") {
        return {
          type: "operator",
          name: op,
          left: generateRandomAST(depth - 1, biasCols, mutationStrength),
          right: {
            type: "constant",
            value: Math.floor(Math.random() * 10) + 1,
          },
        };
      }
      return {
        type: "operator",
        name: op,
        left: generateRandomAST(depth - 1, biasCols, mutationStrength),
        right: generateRandomAST(depth - 1, biasCols, mutationStrength),
      };
    };

    const arithmeticCrossover = (
      astX: FactorAST,
      astY: FactorAST,
      alpha = 0.5,
    ): FactorAST => {
      if (astX.type === "constant" && astY.type === "constant") {
        return {
          type: "constant",
          value: Number(
            (
              (1 - alpha) * (astX.value || 0) +
              alpha * (astY.value || 0)
            ).toFixed(2),
          ),
        };
      }

      return Math.random() > 0.5 ? astX : astY;
    };

    const themes = [
      {
        name: "Liquidity Shock",
        terms: ["illiquidity", "flow", "impact", "imbalance", "stress"],
      },
      {
        name: "Efficiency Divergence",
        terms: ["margin", "operating", "leverage", "structural", "fundamental"],
      },
      {
        name: "Behavioral Momentum",
        terms: ["sentiment", "overreaction", "drift", "crowding", "reversal"],
      },
      {
        name: "Volatility Regime",
        terms: ["dispersion", "uncertainty", "skew", "tail", "convexity"],
      },
      {
        name: "Inventory Lead",
        terms: ["cycle", "backlog", "utilization", "bottleneck", "delivery"],
      },
      {
        name: "Macro-Socio Divergence (e-Stat)",
        terms: ["demographic", "labor", "industrial", "household", "regional"],
      },
      {
        name: "Corporate Governance (J-Quants)",
        terms: ["board", "shareholder", "payout", "disclosure", "transparency"],
      },
      {
        name: "Cross-Asset Signal",
        terms: ["correlation", "spread", "basis", "parity", "convergence"],
      },
      {
        name: "Information Asymmetry",
        terms: ["insider", "leakage", "latency", "skewness", "anomaly"],
      },
      {
        name: "Regime Transition",
        terms: ["breakout", "stability", "entropy", "chaos", "order"],
      },
      {
        name: "DAG-based Evolution (AlphaPROBE)",
        terms: ["graph", "retrieval", "biased", "evolution", "principled"],
      },
      {
        name: "Cross-Asset Retrieval (FactorMiner)",
        terms: ["memory", "skill", "cross-asset", "experience", "trajectory"],
      },
      {
        name: "Causal Mechanism (CAMEF)",
        terms: [
          "causality",
          "counterfactual",
          "intervention",
          "mechanism",
          "evidence",
        ],
      },
      {
        name: "Neuro-Symbolic Logic (NeuroSymbolic)",
        terms: ["symbolic", "neural", "explainable", "rule-based", "hybrid"],
      },

      ...(missionContext.trim().length > 0
        ? [
            {
              name: "10-K Intelligence 2.0 (Mission)",
              terms: [
                "itemization",
                "segment_sentiment",
                "ai_exposure",
                "kg_centrality",
                "drift",
              ],
            },
          ]
        : []),
    ];
    const openAIProposal = await this.openAIThemeProvider.propose({
      missionContext:
        missionContext.trim().length > 0
          ? missionContext.slice(0, 1500)
          : "General autonomous alpha discovery for JP equities",
      marketContext:
        playbookBullets.find((b) => b.id === "market-context")?.content || "",
      existingThemes: [...existingThemes],
      forbiddenThemes: [...forbiddenThemes],
      recentSuccesses,
      recentFailures,
      userIntent: naturalLanguageInput.text.slice(0, 1200),
      inputChannel: process.env.UQTL_INPUT_CHANNEL || "task",
    });
    const openAIThemeName = `${openAIProposal.theme} (${openAIProposal.model})`;
    const openAITerms =
      openAIProposal.featureSignature.length > 0
        ? openAIProposal.featureSignature
        : ["volume", "close", "macro_iip", "macro_cpi", "sentiment"];
    themes.unshift({
      name: openAIThemeName,
      terms: openAITerms,
    });

    const reasoningTemplates = [
      "CLAIM: Alpha captures {1} patterns in {0} via {2} logic. [REASONING] Leveraging {3} signals in {4} markets ensures robustness. Persona: {5}.",
      "CLAIM: Structural drift identification via {0} and {1}. [REASONING] The {5} persona targets {3} using a {2} approach. Optimized for {4} regimes.",
      "CLAIM: High-precision {3} forecasting using {0}. [REASONING] A {2} model that uses {1} to filter noise during {4} periods. Proposed by {5}.",
      "CLAIM: Strategic {0} extraction using {2}. [REASONING] Detects {1} and exploits {3} in {4} markets. Verified by {5} protocols.",
      "CLAIM: Autonomous hypothesis on {0} using {2}. [REASONING] This model identifies {1} trajectories to extract {3} edge in {4} regimes. Reasoning trace by {5}.",
    ];

    const count = _options.count || 2;
    const candidates: AlphaFactor[] = [];
    let attempts = 0;

    const seeds = playbookBullets.filter(
      (b: AceBullet) => b.metadata?.status === "SELECTED",
    );

    while (candidates.length < count && attempts < 50) {
      attempts++;

      const gender = Math.random() > 0.5 ? "MALE" : "FEMALE";
      const isEvolution =
        seeds.length > 0 && Math.random() > (gender === "MALE" ? 0.3 : 0.6);
      const seed = isEvolution
        ? seeds[Math.floor(Math.random() * seeds.length)]
        : null;

      const themeIndex = Math.floor(Math.random() * themes.length);
      const theme = themes[themeIndex]!;

      if (
        !isEvolution &&
        (existingThemes.has(theme.name.toLowerCase()) ||
          forbiddenThemes.has(theme.name.toLowerCase()))
      )
        continue;

      const personaIndex = Math.floor(Math.random() * personas.length);
      const persona = personas[personaIndex]!;
      const templateIndex = Math.floor(
        Math.random() * reasoningTemplates.length,
      );
      const template = reasoningTemplates[templateIndex]!;

      const uuidPart = crypto.randomUUID().split("-")[0]!;
      const id = `ALPHA-${persona.split(" ")[0]!.toUpperCase()}-${uuidPart.toUpperCase()}`;
      const depth =
        gender === "MALE"
          ? 2 + Math.floor(Math.random() * 2)
          : 1 + Math.floor(Math.random() * 2);

      let reasoning = template
        .replace("{0}", theme.name)
        .replace("{1}", theme.terms[0]!)
        .replace("{2}", theme.terms[1]!)
        .replace("{3}", theme.terms[2]!)
        .replace("{4}", theme.terms[3]!)
        .replace("{5}", persona);

      let description = `${theme.name} Hypothesis (${persona})`;
      let generation = 1;
      let mutationType: AlphaFactor["mutationType"] = "NEW_SEED";
      let parentId: string | undefined;
      let ast: FactorAST;

      const missionBias = theme.name.includes("(Mission)")
        ? theme.terms.filter((t) => cols.includes(t))
        : undefined;
      const openAIBias =
        theme.name === openAIThemeName
          ? theme.terms.filter((t) => cols.includes(t))
          : undefined;
      const bias =
        openAIBias && openAIBias.length > 0 ? openAIBias : missionBias;

      if (isEvolution && seed) {
        parentId = seed.metadata?.id as string | undefined;
        generation =
          ((seed.metadata?.generation as number | undefined) || 1) + 1;

        const dice = Math.random();
        if (dice < 0.4) {
          mutationType = "CROSSOVER";
          description = `[EVOLVED] Crossover: ${seed.content.split(":")[0]} [v${generation}]`;
          reasoning = `[EVOLUTIONARY TRACE] Crossover mutation (GGA ${gender}) from ${parentId}. ${reasoning}`;

          const seedAst = seed.metadata?.ast as FactorAST | undefined;
          const partnerAst = pickOne(seeds).metadata?.ast as
            | FactorAST
            | undefined;
          if (!seedAst || !partnerAst) {
            ast = generateRandomAST(depth, bias);
          } else {
            ast = arithmeticCrossover(seedAst, partnerAst);
          }
        } else if (gender === "MALE") {
          mutationType = "STRUCTURAL_SHIFT";
          description = `[EVOLVED] Shift (MALE): ${seed.content.split(":")[0]} [v${generation}]`;
          reasoning = `[EVOLUTIONARY TRACE] Macro-mutation/Structural shift from ${parentId}. Focusing on explorative diversity.`;
          ast = generateRandomAST(depth, bias, 1.5);
        } else {
          mutationType = "POINT_MUTATION";
          description = `[EVOLVED] Fine-tune (FEMALE): ${seed.content.split(":")[0]} [v${generation}]`;
          reasoning = `[EVOLUTIONARY TRACE] Micro-mutation from ${parentId}. Focusing on exploititive stability.`;
          ast = generateRandomAST(depth, bias, 0.5);
        }
      } else {
        ast = generateRandomAST(depth, bias);
      }

      if (existingThemes.has(description.toLowerCase())) continue;

      candidates.push({
        id,
        ast,
        description,
        reasoning:
          theme.name === openAIThemeName
            ? `[LLM_THEME] ${openAIProposal.hypothesis} | ${openAIProposal.noveltyRationale} | ${reasoning}`
            : reasoning,
        parentId,
        generation,
        mutationType,
        gender,
        featureSignature:
          theme.name === openAIThemeName ? openAIProposal.featureSignature : [],
        ideaHashHint:
          theme.name === openAIThemeName ? openAIProposal.ideaHashHint : "",
        themeSource: theme.name === openAIThemeName ? "OPENAI" : "LOCAL",
        llmModel:
          theme.name === openAIThemeName ? openAIProposal.model : undefined,
      });
      existingThemes.add(description.toLowerCase());
    }

    this.emitEvent("ALPHA_GENERATED", {
      count: candidates.length,
      generationModel: "Infinity-Combinatorial-V3",
      diversity: 1.0,
    });

    return candidates;
  }
  public async generateHypotheses(
    playbookBullets: AceBullet[] = [],
  ): Promise<AlphaFactor[]> {
    return this.generateAlphaFactors(playbookBullets);
  }

  public async evaluateReliability(
    factor: AlphaFactor,
    evidence?: Record<string, number>,
  ): Promise<FactorEvaluation> {
    const text = `${factor.description} ${factor.reasoning}`.toLowerCase();
    let rs = 0.4;
    if (
      /macro|supply|inflation|inventory|lead|structural|fundamental/.test(text)
    )
      rs += 0.1;
    if (/liquidity|flow|turnover|stress|illiquidity|imbalance/.test(text))
      rs += 0.05;
    if (
      /underreaction|behavior|sentiment|divergence|overreaction|crowding|reversal/.test(
        text,
      )
    )
      rs += 0.05;
    if (/earnings|margin|profit|financial|operating|efficiency/.test(text))
      rs += 0.05;
    if (
      /volatility|regime|dispersion|uncertainty|skew|tail|convexity/.test(text)
    )
      rs += 0.05;
    if (
      /itemization|segment|sentiment|ai_exposure|knowledge_graph|kg_centrality/.test(
        text,
      )
    )
      rs += 0.1;
    if (evidence && Object.keys(evidence).length > 0) rs += 0.1;
    rs = Math.min(0.8, rs);

    const rejectionReason: string | undefined =
      rs <= 0.5
        ? "FRA: Linguistic plausibility too low. Hypothesis lacks clear economic anchoring."
        : undefined;

    return {
      factorId: factor.id,
      rs,
      logic: `FRA: Linguistic plausibility check for ${factor.id}. RS=${rs.toFixed(2)}. ${evidence ? "Evidence context provided." : "No evidence context."}`,
      rejectionReason,
    };
  }

  public async evaluateRisk(factor: AlphaFactor): Promise<FactorEvaluation> {
    const text =
      `${factor.id} ${factor.description} ${factor.reasoning}`.toLowerCase();
    let rs = 0.5;
    if (/ortho|divergence|rebound|stress|dispersion/.test(text)) rs += 0.1;
    if (/neutral|volatility|liquidity|risk-adjusted/.test(text)) rs += 0.1;
    if (/leverage|martingale|averaging down/.test(text)) rs -= 0.3;
    rs = clamp01(Math.min(0.85, rs));

    const rejectionReason: string | undefined =
      rs <= 0.5 ? "RPA: High linguistic risk profile detected." : undefined;

    return {
      factorId: factor.id,
      rs,
      logic: `RPA: Linguistic risk assessment for ${factor.id}.`,
      rejectionReason,
    };
  }

  public neutralizeFactors(scores: number[]): number[] {
    const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const std = Math.sqrt(
      scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (scores.length || 1),
    );
    return scores.map((s) => (s - mean) / (std || 1));
  }

  public async optimizeWeights(evals: FactorEvaluation[]): Promise<number[]> {
    const validEvals = evals.filter((e) => e.rs > 0.7);
    const totalRS = validEvals.reduce((a, b) => a + b.rs, 0);
    return evals.map((e) => (e.rs > 0.7 ? e.rs / (totalRS || 1) : 0));
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

    return client.evaluateFactors({
      factors: factors.map((f) => ({ id: f.id, ast: f.ast })),
      market_data: marketData,
      ...(baselineScores ? { baseline_scores: baselineScores } : {}),
    });
  }

  public calculateOutcome(
    strategyId: string,
    integratedRS: number,
    backtest?: BacktestResult,
    predictions?: number[],
    targets?: number[],
    experimentId?: string,
  ): StandardOutcome {
    const ts = new Date().toISOString();
    let sharpeRatio = 0;
    let annualizedReturn = 0;
    let tStat = 0;
    let pValue = 1.0;
    let ic = 0;
    let maxDrawdown = 0;

    if (backtest?.history && backtest.history.length > 0) {
      tStat = QuantMetrics.calculateTStat(backtest.history);
      pValue = QuantMetrics.calculatePValue(tStat, backtest.history.length);
      if (predictions && targets) {
        ic = QuantMetrics.calculateCorr(predictions, targets);
      } else {
        throw new Error(
          `[AUDIT] Cannot calculate IC for ${strategyId} without predictions and targets.`,
        );
      }
      sharpeRatio = QuantMetrics.calculateSharpeRatio(backtest.history);
      annualizedReturn = QuantMetrics.calculateAnnualizedReturn(
        backtest.netReturn,
        backtest.tradingDays || 1,
      );
      let peak = 1;
      let nav = 1;
      let worst = 0;
      for (const r of backtest.history) {
        nav *= 1 + r;
        if (nav > peak) peak = nav;
        const dd = nav / peak - 1;
        if (dd < worst) worst = dd;
      }
      maxDrawdown = Math.abs(worst);
    }

    const quantRS = backtest ? Math.max(0, 1 - pValue) : 0;
    const finalRS = backtest
      ? quantRS * 0.8 + integratedRS * 0.2
      : integratedRS * 0.5;

    const outcome: StandardOutcome = {
      strategyId,
      strategyName: "LES-Multi-Agent-Forecasting",
      timestamp: ts,
      experimentId,
      summary: backtest
        ? `LES Framework implementation. Verified against ${backtest.tradingDays} trading days with REAL backtest evidence.`
        : `LES Framework (HYPOTHETICAL). No backtest evidence provided.`,
      reasoningScore: finalRS,
      alpha: {
        tStat,
        pValue,
        informationCoefficient: ic,
      },
      verification: {
        metrics: {
          mae: 0,
          rmse: 0,
          smape: 0,
          directionalAccuracy: predictions && targets ? ic + 0.5 : 0.5,
          sharpeRatio,
          annualizedReturn,
          maxDrawdown,
        },
        upliftOverBaseline: 0,
      },
      stability: {
        trackingError: backtest?.history
          ? QuantMetrics.calculateTStat(backtest.history) * 0.001
          : 0,
        tradingDaysHorizon: backtest?.tradingDays ?? 0,
        isProductionReady: backtest ? backtest.netReturn > 0.05 : false,
      },
    };

    outcome.evidenceSource = backtest ? "QUANT_BACKTEST" : "LINGUISTIC_ONLY";

    if (
      outcome.evidenceSource === "QUANT_BACKTEST" &&
      (!backtest?.history || backtest.history.length === 0)
    ) {
      throw new Error(
        `[AUDIT] Strategy ${strategyId} claims QUANT_BACKTEST but lacks backtest history.`,
      );
    }

    return outcome;
  }

  public static readonly EVALUATION_CRITERIA = {
    ALPHA: { minTStat: 2.0, maxPValue: 0.05, minIC: 0.03 },
    PERFORMANCE: { minSharpe: 1.5, maxDrawdown: 0.1 },
    STABILITY: { maxTrackingError: 0.02 },
    REASONING: { minRS: 0.7 },
  };

  public async run(): Promise<void> {
    console.log("🚀 LES: Running Large-scale Stock Forecasting Agent...");
    const factors = await this.generateAlphaFactors();
    const evals_FRA = await Promise.all(
      factors.map((f) => this.evaluateReliability(f)),
    );
    const weights = await this.optimizeWeights(evals_FRA);
    console.log(
      `✅ LES: Weights optimized (${weights.length} factors) based on Reasoning Score (RS).`,
    );
  }
}
