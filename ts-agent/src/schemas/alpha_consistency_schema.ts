import { z } from "zod";

/**
 * Alpha Candidate Consistency Validation Schema
 * Ensures that the description and AST of an alpha factor are aligned.
 */

export type FactorAST = {
  type: "variable" | "operator" | "constant";
  name?: string;
  value?: number;
  left?: FactorAST;
  right?: FactorAST;
};

/**
 * Extract all variable names from an AST
 */
export function extractVariablesFromAST(ast: FactorAST): Set<string> {
  const variables = new Set<string>();

  function traverse(node: FactorAST | undefined) {
    if (!node) return;
    if (node.type === "variable" && node.name) {
      variables.add(node.name.toLowerCase());
    }
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
  }

  traverse(ast);
  return variables;
}

/**
 * Extract variable names from a description string
 * Looks for common patterns: rank(X), X, macro_*, etc.
 */
export function extractVariablesFromDescription(
  description: string,
): Set<string> {
  const variables = new Set<string>();

  // Pattern: rank(variable_name)
  const rankPattern = /rank\((\w+)\)/gi;
  let match: RegExpExecArray | null = rankPattern.exec(description);
  while (match !== null) {
    variables.add(match[1].toLowerCase());
    match = rankPattern.exec(description);
  }

  // Pattern: specific known variables or patterns (macro_*, sentiment, etc.)
  const varPattern =
    /\b(macro_[a-z0-9_]+|volume|close|open|high|low|sentiment|exposure|centrality|correction_freq|activist_bias|ai_exposure|kg_centrality|segment_sentiment|volatility|momentum)\b/gi;
  let varMatch: RegExpExecArray | null = varPattern.exec(description);
  while (varMatch !== null) {
    const varName = varMatch[1].toLowerCase();
    if (!["low", "high", "open"].includes(varName)) {
      variables.add(varName);
    }
    varMatch = varPattern.exec(description);
  }

  return variables;
}

/**
 * Validate that description and AST are consistent
 * Returns a detailed report of mismatches
 *
 * Logic (from AAARTS design spec):
 * - Extract variables from description text
 * - Extract variables from AST
 * - Check if both sets are equal for strict consistency
 * - Collect mismatched variables (union of missing and extra)
 * - Generate [AUDIT] error message if inconsistent
 */
export function validateAlphaCandidateConsistency(
  description: string,
  ast: FactorAST,
): {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
  mismatchVars: string[];
  missingInAST: string[];
  extraInAST: string[];
  errorMessage?: string;
} {
  const descVars = Array.from(extractVariablesFromDescription(description));
  const astVars = Array.from(extractVariablesFromAST(ast));

  const descVarSet = new Set(descVars);
  const astVarSet = new Set(astVars);

  // Variables in description but not in AST
  const missingInAST = descVars.filter((v) => !astVarSet.has(v));

  // Variables in AST but not in description
  const extraInAST = astVars.filter((v) => !descVarSet.has(v));

  // Combined mismatch variables (per spec)
  const mismatchVars = Array.from(new Set([...missingInAST, ...extraInAST]));

  // Strict consistency check (AAARTS Phase 1)
  // Logic: Description and AST must be exactly aligned.
  // We check for any mismatch (missing in AST or extra in AST).
  const isConsistent = mismatchVars.length === 0;

  // Generate [AUDIT] message
  const errorMessage = !isConsistent
    ? `[AUDIT] Alpha description-AST mismatch: description mentions [${missingInAST.join(
        ", ",
      )}] but AST includes [${astVars.join(", ")}]`
    : undefined;

  return {
    isConsistent,
    descriptionVars: descVars,
    astVars: astVars,
    mismatchVars,
    missingInAST,
    extraInAST,
    errorMessage,
  };
}

/**
 * Zod schema for consistency validation
 */
export const AlphaConsistencyCheckSchema = z.object({
  candidateId: z.string(),
  description: z.string().min(1),
  ast: z.object({}).passthrough(), // FactorAST as flexible object
  consistencyCheck: z.object({
    isConsistent: z.boolean(),
    missingInAST: z.array(z.string()),
    extraInAST: z.array(z.string()),
  }),
});

export type AlphaConsistencyCheck = z.infer<typeof AlphaConsistencyCheckSchema>;
