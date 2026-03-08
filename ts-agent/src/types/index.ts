/**
 * ✨ プロジェクト共通の型定義（Types）だよっ！ ✨
 */

export interface AlphaFactor {
  id: string;
  formula: string;
  description: string;
  reasoning: string;
  parentId?: string;
  generation: number;
  mutationType:
    | "NEW_SEED"
    | "POINT_MUTATION"
    | "STRUCTURAL_SHIFT"
    | "CROSSOVER";
  gender: "MALE" | "FEMALE";
  featureSignature: string[];
  ideaHashHint?: string;
  themeSource: "LOCAL" | "OPENAI";
  llmModel?: string;
}

export interface FactorEvaluation {
  factorId: string;
  rs: number; // Reasoning Score
  logic: string;
  rejectionReason?: string;
}

export interface ComputeMarketData {
  symbol: string;
  date: string;
  values: Record<string, number>;
}

export interface ComputeResponse {
  results: Array<{
    id: string;
    scores: { symbol: string; score: number }[];
  }>;
}

export interface BacktestResult {
  strategyId: string;
  netReturn: number;
  tradingDays: number;
  history: number[]; // Daily returns
}
