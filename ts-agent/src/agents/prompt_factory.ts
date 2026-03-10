import { pickOne } from "../utils/math_utils.ts";

/**
 * ✨ エージェントたちの知恵の源、プロンプト工場だよっ！ ✨
 */
export namespace PromptFactory {
  /**
   * アルファ生成のためのペルソナリストだよっ！🎭
   */
  export const PERSONAS = [
    "Quant Analyst",
    "Macro Strategist",
    "Behavioral Economist",
    "HFT Engineer",
    "Fundamental Researcher",
    "Data Scientist",
    "Risk Manager",
  ];

  /**
   * アルファ生成の基本テーマだよっ！🌟
   */
  export const BASE_THEMES = [
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
      name: "Macro-Socio Divergence",
      terms: ["demographic", "labor", "industrial", "household", "regional"],
    },
    {
      name: "Corporate Governance",
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
  ];

  /**
   * 推論テンプレートだよっ！📝
   */
  export const REASONING_TEMPLATES = [
    "CLAIM: Alpha captures {1} patterns in {0} via {2} logic. [REASONING] Leveraging {3} signals in {4} markets ensures robustness. Persona: {5}.",
    "CLAIM: Structural drift identification via {0} and {1}. [REASONING] The {5} persona targets {3} using a {2} approach. Optimized for {4} regimes.",
    "CLAIM: High-precision {3} forecasting using {0}. [REASONING] A {2} model that uses {1} to filter noise during {4} periods. Proposed by {5}.",
    "CLAIM: Strategic {0} extraction using {2}. [REASONING] Detects {1} and exploits {3} in {4} markets. Verified by {5} protocols.",
    "CLAIM: Autonomous hypothesis on {0} using {2}. [REASONING] This model identifies {1} trajectories to extract {3} edge in {4} regimes. Reasoning trace by {5}.",
  ];

  /**
   * ランダムなペルソナを一つ選ぶよっ！🎭
   */
  export function pickPersona(): string {
    return pickOne(PERSONAS);
  }

  /**
   * 推論テキストをテンプレートから生成するよっ！📝✨
   */
  export function formatReasoning(params: {
    themeName: string;
    terms: string[];
    persona: string;
  }): string {
    const template = pickOne(REASONING_TEMPLATES);
    let reasoning = template.replace("{0}", params.themeName);
    for (let i = 0; i < 4; i++) {
      reasoning = reasoning.replace(`{${i + 1}}`, params.terms[i] || "N/A");
    }
    return reasoning.replace("{5}", params.persona);
  }
}
