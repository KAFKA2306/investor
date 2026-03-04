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

  // Pattern: variable * constant, variable + constant, etc.
  const varPattern =
    /\b(macro_\w+|volume|close|open|high|low|sentiment|exposure|centrality|[a-z_]+)\b/gi;
  let varMatch: RegExpExecArray | null = varPattern.exec(description);
  while (varMatch !== null) {
    const varName = varMatch[1].toLowerCase();
    // Filter out common keywords and function names
    if (
      ![
        "and",
        "or",
        "the",
        "with",
        "using",
        "rank",
        "blend",
        "reversal",
        "combined",
        "momentum",
        "volatility",
      ].includes(varName)
    ) {
      variables.add(varName);
    }
    varMatch = varPattern.exec(description);
  }

  return variables;
}

/**
 * Validate that description and AST are consistent
 * Returns a detailed report of mismatches
 */
export function validateAlphaCandidateConsistency(
  description: string,
  ast: FactorAST,
): {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
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

  // Strict check: if description mentions a specific variable,
  // AST must include it. However, AST can have extra variables
  // (e.g., if AST is more granular than description suggests).
  const isConsistent = missingInAST.length === 0;

  return {
    isConsistent,
    descriptionVars: descVars,
    astVars: astVars,
    missingInAST,
    extraInAST,
    errorMessage: isConsistent
      ? undefined
      : `Description mentions [${missingInAST.join(
          ", ",
        )}] but AST does not include them`,
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
