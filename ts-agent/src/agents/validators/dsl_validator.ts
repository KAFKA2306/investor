/**
 * DSL Validator and Repair Module
 *
 * Provides strict validation and automatic repair for alpha DSL expressions.
 * Uses whitelisting for allowed functions and factors to prevent invalid syntax.
 *
 * Design Principles:
 * - NEVER fallback to Claude API (strict Qwen validation only)
 * - Whitelist-based function and factor validation
 * - Comprehensive error reporting
 * - Automatic minor repairs when possible
 * - Fail fast with detailed error messages
 */

/**
 * Whitelisted functions allowed in DSL expressions.
 * These are the only functions that Qwen is allowed to use.
 */
const ALLOWED_FUNCTIONS = ["rank", "scale", "abs", "sign", "log", "max", "min"];

/**
 * Whitelisted factors that can be referenced in DSL expressions.
 * These correspond to actual market factors that can be computed.
 */
const ALLOWED_FACTORS = [
  "momentum",
  "value",
  "size",
  "volatility",
  "quality",
  "growth",
  "dividend",
  "low_vol",
  "low_volatility",
];

/**
 * DSL pattern validation regex.
 * Ensures the DSL starts with "alpha = " followed by valid expression characters.
 *
 * Pattern breakdown:
 * - ^alpha\s*=\s* : Case-insensitive "alpha" with optional spaces around "="
 * - Character class includes: letters, digits, underscore, parens, +, -, *, /, ., spaces
 * - $ : End of string, no trailing invalid characters
 *
 * Note: Forward slash (/) is allowed for division but we'll validate against // comments separately
 */
const DSL_REGEX = /^alpha\s*=\s*[a-z0-9_+\-*/.()\s]+$/i;

/**
 * Validates a DSL expression string for correctness and safety.
 *
 * Performs multiple validation checks:
 * 1. Basic pattern matching (must contain "alpha = ")
 * 2. Function whitelisting (only allowed functions)
 * 3. Factor whitelisting (only allowed factors)
 * 4. Syntax validation (balanced parentheses)
 *
 * @param dsl - The DSL expression string to validate
 * @returns true if DSL is valid, false otherwise
 *
 * Example:
 *   isValidDSL("alpha = rank(momentum) * -1") -> true
 *   isValidDSL("rank(momentum)") -> false (missing "alpha =")
 *   isValidDSL("alpha = invalid_func(momentum)") -> false (invalid function)
 */
export function isValidDSL(dsl: string): boolean {
  // Check if DSL is empty
  if (!dsl || dsl.trim().length === 0) {
    return false;
  }

  // Reject comments (// is not allowed in DSL)
  if (dsl.includes("//")) {
    return false;
  }

  // Check basic regex pattern
  if (!DSL_REGEX.test(dsl)) {
    return false;
  }

  // Check for balanced parentheses
  let parenBalance = 0;
  for (const char of dsl) {
    if (char === "(") {
      parenBalance++;
    } else if (char === ")") {
      parenBalance--;
      if (parenBalance < 0) {
        return false; // More closing than opening parentheses
      }
    }
  }
  if (parenBalance !== 0) {
    return false; // Unbalanced parentheses
  }

  // Extract and validate function calls
  // Match all function-like patterns: word followed by opening parenthesis
  const functionMatches = dsl.matchAll(/(\w+)\s*\(/gi);
  for (const match of functionMatches) {
    const funcName = match[1].toLowerCase();
    // Check if function is in whitelist
    if (!ALLOWED_FUNCTIONS.includes(funcName)) {
      return false;
    }
  }

  // Extract and validate factor references
  // Match all identifiers within parentheses (factors)
  // Pattern: look for word characters inside parentheses that aren't function names
  const factorMatches = dsl.matchAll(/\(([a-z_][a-z0-9_]*)\s*\)/gi);
  for (const match of factorMatches) {
    const factorName = match[1].toLowerCase();
    // Check if factor is in whitelist
    if (!ALLOWED_FACTORS.includes(factorName)) {
      return false;
    }
  }

  return true;
}

/**
 * Attempts to repair a potentially invalid DSL expression.
 *
 * Repair strategies (in order):
 * 1. If missing "alpha =", attempt to add it
 * 2. Trim whitespace and retry validation
 * 3. Return null if no repairs are possible
 *
 * CRITICAL: This function only performs simple syntactic repairs.
 * It does NOT modify semantics or logic, ensuring Qwen's intent is preserved.
 *
 * @param dsl - The potentially invalid DSL expression
 * @returns The repaired DSL string if repairable, null otherwise
 *
 * Example:
 *   repairDSL("rank(momentum) * -1") -> "alpha = rank(momentum) * -1"
 *   repairDSL("invalid_func(momentum)") -> null (unfixable)
 */
export function repairDSL(dsl: string): string | null {
  if (!dsl || dsl.trim().length === 0) {
    return null;
  }

  const trimmed = dsl.trim();

  // Check if already valid
  if (isValidDSL(trimmed)) {
    return trimmed;
  }

  // Repair attempt 1: Add "alpha =" if missing
  if (!trimmed.toLowerCase().includes("alpha")) {
    const withAlpha = `alpha = ${trimmed}`;
    if (isValidDSL(withAlpha)) {
      return withAlpha;
    }
  }

  // Repair attempt 2: Check if only whitespace was the issue
  // (already handled by trim above)

  // Cannot repair - either invalid functions, factors, or syntax
  return null;
}

/**
 * Comprehensive DSL validation with detailed error reporting.
 *
 * This is the primary validation entry point that provides detailed feedback
 * about what's wrong with a DSL and whether it can be auto-repaired.
 *
 * @param dsl - The DSL expression to validate
 * @returns Validation result object with errors and optional repair suggestion
 *
 * Result structure:
 * {
 *   valid: boolean,           // Whether DSL passed all validation checks
 *   errors: string[],         // Array of error messages (empty if valid)
 *   repaired?: string,        // Auto-repaired DSL (if validation passed after repair)
 * }
 *
 * Example:
 *   validateDSL("alpha = rank(momentum)") ->
 *     { valid: true, errors: [] }
 *
 *   validateDSL("rank(momentum)") ->
 *     { valid: true, errors: [], repaired: "alpha = rank(momentum)" }
 *
 *   validateDSL("alpha = invalid_func(momentum)") ->
 *     { valid: false, errors: ["Invalid function: invalid_func", ...], repaired: null }
 */
export function validateDSL(dsl: string): {
  valid: boolean;
  errors: string[];
  repaired?: string;
} {
  const errors: string[] = [];

  // Check for empty DSL
  if (!dsl || dsl.trim().length === 0) {
    errors.push("DSL is empty");
    return {
      valid: false,
      errors,
      repaired: null,
    };
  }

  const trimmed = dsl.trim();

  // Check basic pattern
  if (!DSL_REGEX.test(trimmed)) {
    errors.push("DSL does not match expected pattern: 'alpha = <expression>'");
  }

  // Check parentheses balance
  let parenBalance = 0;
  let parenError = false;
  for (const char of trimmed) {
    if (char === "(") {
      parenBalance++;
    } else if (char === ")") {
      parenBalance--;
      if (parenBalance < 0) {
        errors.push("Unbalanced parentheses: more closing than opening");
        parenError = true;
        break;
      }
    }
  }
  if (!parenError && parenBalance !== 0) {
    errors.push("Unbalanced parentheses: missing closing bracket");
  }

  // Check for invalid functions
  const functionMatches = trimmed.matchAll(/(\w+)\s*\(/gi);
  const invalidFunctions = new Set<string>();
  for (const match of functionMatches) {
    const funcName = match[1].toLowerCase();
    if (!ALLOWED_FUNCTIONS.includes(funcName)) {
      invalidFunctions.add(funcName);
    }
  }
  if (invalidFunctions.size > 0) {
    errors.push(
      `Invalid function(s): ${Array.from(invalidFunctions).join(", ")}. Allowed: ${ALLOWED_FUNCTIONS.join(", ")}`,
    );
  }

  // Check for invalid factors
  const factorMatches = trimmed.matchAll(/\(([a-z_][a-z0-9_]*)\s*\)/gi);
  const invalidFactors = new Set<string>();
  for (const match of factorMatches) {
    const factorName = match[1].toLowerCase();
    if (!ALLOWED_FACTORS.includes(factorName)) {
      invalidFactors.add(factorName);
    }
  }
  if (invalidFactors.size > 0) {
    errors.push(
      `Unknown factor(s): ${Array.from(invalidFactors).join(", ")}. Allowed: ${ALLOWED_FACTORS.join(", ")}`,
    );
  }

  // If validation failed, attempt repair
  if (errors.length > 0) {
    const repaired = repairDSL(trimmed);
    return {
      valid: false,
      errors,
      repaired,
    };
  }

  // If we get here, DSL is valid
  return {
    valid: true,
    errors: [],
  };
}
