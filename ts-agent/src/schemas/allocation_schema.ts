import { z } from "zod";

/**
 * ✨ 投資アイデアと配分リクエストの最強スキーマ集だよっ！ ✨
 */

/**
 * 個別の投資アイデアを表すスキーマだよっ！🎯
 */
export const InvestmentIdeaSchema = z.object({
  ticker: z.string().describe("銘柄コード（例: 7203.T）"),
  strategyType: z.string().describe("戦略の種類"),
  confidence: z.number().min(0).max(1).describe("確信度（0.0 〜 1.0）"),
  expectedReturn: z.number().describe("期待リターン"),
  volatility: z.number().positive().describe("予想ボラティリティ"),
  ideaHash: z.string().describe("アイデアの一意なハッシュ"),
});

export type InvestmentIdea = z.infer<typeof InvestmentIdeaSchema>;

/**
 * ポートフォリオ配分リクエストのスキーマだよっ！📋
 */
export const AllocationRequestSchema = z.object({
  ideas: z.array(InvestmentIdeaSchema).min(1).describe("投資アイデアのリスト"),
  totalCapital: z.number().positive().describe("運用総資金"),
  asOfDate: z.string().datetime().describe("基準日時（ISO形式）"),
});

export type AllocationRequest = z.infer<typeof AllocationRequestSchema>;

/**
 * 配分結果を表すスキーマだよっ！💰
 */
export const AllocationResultSchema = z.object({
  ticker: z.string(),
  weight: z.number().describe("ポートフォリオ内での重み"),
  amount: z.number().describe("具体的な配分割当額"),
  reasoning: z.string().describe("配分理由の説明"),
});

export type AllocationResult = z.infer<typeof AllocationResultSchema>;
