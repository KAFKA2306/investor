/**
 * Orthogonality Scorer
 *
 * Measures the differentiation of a new alpha factor from existing playbook patterns
 * using Jaccard distance (set-based similarity metric).
 *
 * Jaccard distance = 1 - (|A ∩ B| / |A ∪ B|)
 * Where:
 *   - A = factors in new DSL
 *   - B = factors in playbook pattern
 *   - Result: 1.0 = completely new, 0.0 = completely duplicate
 */

export interface PlaybookPattern {
  factorSet: string[];
  fitnessScore: number;
}

/**
 * Extracts factor names from a DSL string.
 *
 * Strategy:
 * 1. Find all identifiers followed by "(" - these are function calls
 * 2. For non-transformation functions, the argument is a factor name
 * 3. For transformation functions, recursively extract from their arguments
 * 4. Also extract bare identifiers (those not followed by parentheses or operators)
 * 5. Return unique factor names
 *
 * Example:
 *   Input: "alpha = rank(low_volatility) + rank(momentum)"
 *   Output: ["low_volatility", "momentum"]
 */
export function extractFactorsFromDSL(dsl: string): string[] {
  // Known transformation functions to exclude
  const excludeFunctions = new Set([
    "rank",
    "scale",
    "abs",
    "sign",
    "log",
    "exp",
    "sqrt",
    "pow",
    "clip",
    "winsorize",
  ]);

  const factorNames: string[] = [];

  // First, remove the "alpha = " part and clean up
  const cleanDsl = dsl.replace(/^\s*[a-z_]\w*\s*=\s*/, "");

  // Extract function calls using regex
  const functionCallPattern = /\b([a-z_][a-z0-9_]*)\s*\(/gi;
  const functionMatches = Array.from(cleanDsl.matchAll(functionCallPattern));

  for (const functionCallMatch of functionMatches) {
    const functionName = functionCallMatch[1];
    const openParenPos =
      functionCallMatch.index + functionCallMatch[0].length - 1;

    // Find the matching closing parenthesis
    let depth = 0;
    let closeParenPos = openParenPos;
    for (let i = openParenPos; i < cleanDsl.length; i++) {
      if (cleanDsl[i] === "(") depth++;
      if (cleanDsl[i] === ")") {
        depth--;
        if (depth === 0) {
          closeParenPos = i;
          break;
        }
      }
    }

    const argument = cleanDsl.substring(openParenPos + 1, closeParenPos).trim();

    // If NOT a transformation function, the argument is the factor
    if (!excludeFunctions.has(functionName.toLowerCase())) {
      if (argument.length > 0) {
        factorNames.push(argument);
      }
    } else {
      // For transformation functions, recursively extract factors from arguments
      const innerFactors = extractFactorsFromDSL(argument);
      factorNames.push(...innerFactors);
    }
  }

  // Also extract bare identifiers (not followed by parentheses)
  // These are factor names used directly
  const bareIdentifierPattern = /\b([a-z_][a-z0-9_]*)\b(?!\s*[(\w])/gi;
  const bareMatches = Array.from(cleanDsl.matchAll(bareIdentifierPattern));

  for (const bareIdentifierMatch of bareMatches) {
    const identifier = bareIdentifierMatch[1];
    // Skip if it's a known function or reserved word
    if (
      !excludeFunctions.has(identifier.toLowerCase()) &&
      !["alpha", "and", "or", "if", "then", "else", "return"].includes(
        identifier.toLowerCase(),
      )
    ) {
      factorNames.push(identifier);
    }
  }

  // Return unique factors only
  return Array.from(new Set(factorNames));
}

/**
 * Computes the orthogonality score for a set of factors against playbook patterns.
 *
 * Uses Jaccard distance (1 - Jaccard similarity):
 * - Jaccard similarity = |A ∩ B| / |A ∪ B|
 * - Jaccard distance = 1 - similarity
 *
 * Returns the MINIMUM distance (best orthogonality) across all patterns.
 * - 1.0 = completely new (all factors are novel)
 * - 0.0 = complete duplicate (exact factor match with a pattern)
 * - 0.0-1.0 = partial overlap
 *
 * @param dslFactors - Array of factors extracted from the DSL
 * @param playbookPatterns - Array of historical successful patterns
 * @returns Orthogonality score between 0.0 and 1.0
 */
export function computeOrthogonalityScore(
  dslFactors: string[],
  playbookPatterns: PlaybookPattern[],
): number {
  // Edge cases
  if (dslFactors.length === 0 || playbookPatterns.length === 0) {
    return 1.0; // Completely new if no factors or no patterns to compare
  }

  // Convert to Set for efficient set operations
  const dslSet = new Set(dslFactors);

  // Calculate Jaccard distance for each pattern and find the minimum (best orthogonality)
  let minJaccardDistance = 1.0;

  for (const pattern of playbookPatterns) {
    const patternSet = new Set(pattern.factorSet);

    // Calculate intersection
    const intersection = Array.from(dslSet).filter((factor) =>
      patternSet.has(factor),
    );
    const intersectionSize = intersection.length;

    // Calculate union
    const union = new Set([...dslSet, ...patternSet]);
    const unionSize = union.size;

    // Compute Jaccard similarity and distance
    const jaccardSimilarity =
      unionSize === 0 ? 0 : intersectionSize / unionSize;
    const jaccardDistance = 1.0 - jaccardSimilarity;

    // Track the minimum distance (best orthogonality)
    minJaccardDistance = Math.min(minJaccardDistance, jaccardDistance);
  }

  return minJaccardDistance;
}
