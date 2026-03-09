import { z } from "zod";
import { QLIB_ALLOWED_COLUMNS } from "../../schemas/alpha_consistency_schema.ts";
import type { Skill } from "../types.ts";

const inputSchema = z.object({ formula: z.string().min(1) });
type Input = z.infer<typeof inputSchema>;
type Output = { valid: boolean; error?: string };

export const validateQlibFormulaSkill: Skill<Input, Output> = {
  name: "validate_qlib_formula",
  description:
    "qlib式アルファ表現の構文を検証する。未知のカラム参照や括弧の不整合を検出する。",
  schema: inputSchema,
  execute: async ({ formula }) => {
    const usedColumns = formula.match(/\$(\w+)/g)?.map((c) => c.slice(1)) ?? [];
    const unknown = usedColumns.filter((col) => !QLIB_ALLOWED_COLUMNS.has(col));
    if (unknown.length > 0) {
      return { valid: false, error: `Unknown columns: ${unknown.join(", ")}` };
    }

    let depth = 0;
    for (const char of formula) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (depth < 0) return { valid: false, error: "Unbalanced parentheses" };
    }
    if (depth !== 0) return { valid: false, error: "Unbalanced parentheses" };

    return { valid: true };
  },
};
