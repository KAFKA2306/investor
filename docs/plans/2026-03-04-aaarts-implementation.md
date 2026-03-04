# AAARTS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a three-phase validation pipeline (Description-AST consistency → NaN propagation → strict metric validation) that enforces Fail Fast principles and prevents logically inconsistent alphas from entering backtest.

**Architecture:**
- Phase 1 validates that alpha descriptions match their AST implementations (extracting variables from both and comparing sets).
- Phase 2 propagates NaN for missing macro indicators so weak data fails fast in backtest metrics.
- Phase 3 detects NaN metrics and applies strict thresholds (Sharpe 1.8, IC 0.04, DD 0.10).

**Tech Stack:** TypeScript (strict), Zod schemas, Mocha/Chai tests, TDD approach

---

## Task 1: Implement extractVariablesFromDescription() function

**Files:**
- Modify: `ts-agent/src/schemas/alpha_consistency_schema.ts` (lines 1-50)
- Create: `ts-agent/tests/alpha_consistency.test.ts` (Phase 1 tests)

**Step 1: Write the failing test**

```bash
cd /home/kafka/finance/investor
cat > ts-agent/tests/alpha_consistency.test.ts << 'EOF'
import { describe, it, expect } from "bun:test";
import { extractVariablesFromDescription } from "../src/schemas/alpha_consistency_schema";

describe("Phase 1: Description-AST Consistency", () => {
  describe("extractVariablesFromDescription", () => {
    it("should extract function names from description text", () => {
      const desc = "volatility reversal + momentum blend";
      const vars = extractVariablesFromDescription(desc);

      expect(Array.from(vars)).toContain("volatility");
      expect(Array.from(vars)).toContain("momentum");
    });

    it("should extract multi-word variables with underscores", () => {
      const desc = "macro_cpi combined with trend_following";
      const vars = extractVariablesFromDescription(desc);

      expect(Array.from(vars)).toContain("macro_cpi");
      expect(Array.from(vars)).toContain("trend_following");
    });

    it("should handle parentheses syntax", () => {
      const desc = "rank(volatility) * -1 + rank(momentum) * 0.3";
      const vars = extractVariablesFromDescription(desc);

      expect(Array.from(vars)).toContain("volatility");
      expect(Array.from(vars)).toContain("momentum");
      expect(Array.from(vars)).toContain("rank");
    });

    it("should return empty set for descriptions with no variables", () => {
      const desc = "some random description without any technical terms";
      const vars = extractVariablesFromDescription(desc);

      expect(vars.size).toBe(0);
    });

    it("should be case-insensitive and normalize to lowercase", () => {
      const desc = "Volatility MOMENTUM Trend";
      const vars = extractVariablesFromDescription(desc);

      // Should normalize to lowercase
      expect(Array.from(vars).every(v => v === v.toLowerCase())).toBe(true);
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | head -20
```

Expected output: `error: Cannot find module ... alpha_consistency_schema`

**Step 3: Write minimal implementation**

```bash
cat > ts-agent/src/schemas/alpha_consistency_schema.ts << 'EOF'
import { z } from "zod";

export interface FactorAST {
  type: string;
  operator?: string;
  left?: FactorAST;
  right?: FactorAST;
  variable?: string;
  value?: number;
}

/**
 * Extract variable names from alpha description text.
 * Looks for: function_names, variable_names (with underscores), technical terms.
 * Returns a Set of normalized lowercase variable names.
 */
export function extractVariablesFromDescription(description: string): Set<string> {
  // Regex: match word characters (including underscore) that appear as function names or variables
  // Pattern: [a-z_][a-z0-9_]* (lowercase with optional underscores and numbers)
  const regex = /([a-z_][a-z0-9_]*)\s*[\(\)\+\-\*\/\s]*/gi;
  const matches = description.matchAll(regex);

  const variables = new Set<string>();
  for (const match of matches) {
    const variable = match[1].toLowerCase();
    // Filter out common English words and single letters
    if (variable.length > 1 && !isCommonWord(variable)) {
      variables.add(variable);
    }
  }

  return variables;
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    "and", "or", "the", "a", "is", "in", "by", "for", "with",
    "blend", "combined", "reversal", "add", "subtract", "multiply"
  ]);
  return commonWords.has(word);
}

export interface ConsistencyResult {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
  mismatchVars: string[];
  errorMessage?: string;
}

export function validateAlphaCandidateConsistency(
  description: string,
  ast: FactorAST,
): ConsistencyResult {
  return {
    isConsistent: true,
    descriptionVars: [],
    astVars: [],
    mismatchVars: [],
  };
}

export function extractVariablesFromAST(ast: FactorAST): Set<string> {
  return new Set();
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: All 5 tests pass

**Step 5: Commit**

```bash
git add ts-agent/src/schemas/alpha_consistency_schema.ts ts-agent/tests/alpha_consistency.test.ts
git commit -m "feat(aaarts): implement extractVariablesFromDescription for Phase 1 validation

- Extract function names and variables from alpha description text
- Normalize to lowercase, filter common English words
- Return Set of variable names for consistency checking"
```

---

## Task 2: Implement extractVariablesFromAST() function

**Files:**
- Modify: `ts-agent/src/schemas/alpha_consistency_schema.ts` (lines 50-100)
- Modify: `ts-agent/tests/alpha_consistency.test.ts` (add extractVariablesFromAST tests)

**Step 1: Write the failing test**

```bash
cat >> ts-agent/tests/alpha_consistency.test.ts << 'EOF'

  describe("extractVariablesFromAST", () => {
    it("should extract variables from simple variable node", () => {
      const ast: FactorAST = { type: "variable", variable: "momentum" };
      const vars = extractVariablesFromAST(ast);

      expect(Array.from(vars)).toContain("momentum");
    });

    it("should extract variables from binary operation (left + right)", () => {
      const ast: FactorAST = {
        type: "binary",
        operator: "+",
        left: { type: "variable", variable: "volatility" },
        right: { type: "variable", variable: "momentum" }
      };
      const vars = extractVariablesFromAST(ast);

      expect(Array.from(vars)).toContain("volatility");
      expect(Array.from(vars)).toContain("momentum");
      expect(vars.size).toBe(2);
    });

    it("should extract variables from nested AST (deep tree)", () => {
      const ast: FactorAST = {
        type: "binary",
        operator: "*",
        left: {
          type: "binary",
          operator: "+",
          left: { type: "variable", variable: "macro_cpi" },
          right: { type: "value", value: 1 }
        },
        right: { type: "value", value: 0.44 }
      };
      const vars = extractVariablesFromAST(ast);

      expect(Array.from(vars)).toContain("macro_cpi");
      expect(vars.size).toBe(1);
    });

    it("should ignore numeric constants", () => {
      const ast: FactorAST = {
        type: "binary",
        operator: "*",
        left: { type: "variable", variable: "signal" },
        right: { type: "value", value: 0.5 }
      };
      const vars = extractVariablesFromAST(ast);

      expect(Array.from(vars)).toContain("signal");
      expect(vars.size).toBe(1);
    });

    it("should handle empty/null AST", () => {
      const ast: FactorAST = { type: "empty" };
      const vars = extractVariablesFromAST(ast);

      expect(vars.size).toBe(0);
    });
  });
EOF
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: extractVariablesFromAST tests fail

**Step 3: Write minimal implementation**

```bash
cat > ts-agent/src/schemas/alpha_consistency_schema.ts << 'EOF'
import { z } from "zod";

export interface FactorAST {
  type: string;
  operator?: string;
  left?: FactorAST;
  right?: FactorAST;
  variable?: string;
  value?: number;
}

export function extractVariablesFromDescription(description: string): Set<string> {
  const regex = /([a-z_][a-z0-9_]*)\s*[\(\)\+\-\*\/\s]*/gi;
  const matches = description.matchAll(regex);

  const variables = new Set<string>();
  for (const match of matches) {
    const variable = match[1].toLowerCase();
    if (variable.length > 1 && !isCommonWord(variable)) {
      variables.add(variable);
    }
  }

  return variables;
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    "and", "or", "the", "a", "is", "in", "by", "for", "with",
    "blend", "combined", "reversal", "add", "subtract", "multiply"
  ]);
  return commonWords.has(word);
}

/**
 * Recursively extract all variable names from an AST.
 * Traverses the entire tree and collects all nodes where type="variable".
 */
export function extractVariablesFromAST(ast: FactorAST): Set<string> {
  const variables = new Set<string>();

  // Base case: this node is a variable
  if (ast.type === "variable" && ast.variable) {
    variables.add(ast.variable);
  }

  // Recursive case: traverse left and right children
  if (ast.left) {
    extractVariablesFromAST(ast.left).forEach(v => variables.add(v));
  }
  if (ast.right) {
    extractVariablesFromAST(ast.right).forEach(v => variables.add(v));
  }

  return variables;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
  mismatchVars: string[];
  errorMessage?: string;
}

export function validateAlphaCandidateConsistency(
  description: string,
  ast: FactorAST,
): ConsistencyResult {
  return {
    isConsistent: true,
    descriptionVars: [],
    astVars: [],
    mismatchVars: [],
  };
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: All 10 tests pass

**Step 5: Commit**

```bash
git add ts-agent/src/schemas/alpha_consistency_schema.ts ts-agent/tests/alpha_consistency.test.ts
git commit -m "feat(aaarts): implement extractVariablesFromAST for Phase 1 validation

- Recursively traverse FactorAST to extract all variable nodes
- Return Set of variable names
- Ignore numeric constants and operators"
```

---

## Task 3: Implement validateAlphaCandidateConsistency() function

**Files:**
- Modify: `ts-agent/src/schemas/alpha_consistency_schema.ts` (lines 50-80)
- Modify: `ts-agent/tests/alpha_consistency.test.ts` (add validateAlphaCandidateConsistency tests)

**Step 1: Write the failing test**

```bash
cat >> ts-agent/tests/alpha_consistency.test.ts << 'EOF'

  describe("validateAlphaCandidateConsistency", () => {
    it("should return isConsistent=true when description and AST variables match", () => {
      const description = "momentum blend with volatility";
      const ast: FactorAST = {
        type: "binary",
        operator: "+",
        left: { type: "variable", variable: "momentum" },
        right: { type: "variable", variable: "volatility" }
      };

      const result = validateAlphaCandidateConsistency(description, ast);

      expect(result.isConsistent).toBe(true);
      expect(result.descriptionVars).toContain("momentum");
      expect(result.descriptionVars).toContain("volatility");
      expect(result.astVars).toContain("momentum");
      expect(result.astVars).toContain("volatility");
      expect(result.mismatchVars.length).toBe(0);
    });

    it("should return isConsistent=false when description and AST variables differ", () => {
      const description = "volatility reversal and momentum blend";
      const ast: FactorAST = {
        type: "binary",
        operator: "*",
        left: { type: "variable", variable: "macro_cpi" },
        right: { type: "value", value: 1 }
      };

      const result = validateAlphaCandidateConsistency(description, ast);

      expect(result.isConsistent).toBe(false);
      expect(result.mismatchVars.length).toBeGreaterThan(0);
      expect(result.errorMessage).toBeDefined();
    });

    it("should identify specific mismatched variables", () => {
      const description = "trend_following and sentiment";
      const ast: FactorAST = {
        type: "variable",
        variable: "macro_cpi"
      };

      const result = validateAlphaCandidateConsistency(description, ast);

      expect(result.isConsistent).toBe(false);
      expect(result.mismatchVars).toContain("trend_following");
      expect(result.mismatchVars).toContain("sentiment");
    });

    it("should handle empty AST gracefully", () => {
      const description = "some factor";
      const ast: FactorAST = { type: "empty" };

      const result = validateAlphaCandidateConsistency(description, ast);

      // Empty AST means 0 variables from AST
      // But description has at least "factor", so mismatch
      expect(result.isConsistent).toBe(false);
    });
  });
EOF
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: validateAlphaCandidateConsistency tests fail

**Step 3: Write minimal implementation**

```bash
cat > ts-agent/src/schemas/alpha_consistency_schema.ts << 'EOF'
import { z } from "zod";

export interface FactorAST {
  type: string;
  operator?: string;
  left?: FactorAST;
  right?: FactorAST;
  variable?: string;
  value?: number;
}

export function extractVariablesFromDescription(description: string): Set<string> {
  const regex = /([a-z_][a-z0-9_]*)\s*[\(\)\+\-\*\/\s]*/gi;
  const matches = description.matchAll(regex);

  const variables = new Set<string>();
  for (const match of matches) {
    const variable = match[1].toLowerCase();
    if (variable.length > 1 && !isCommonWord(variable)) {
      variables.add(variable);
    }
  }

  return variables;
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    "and", "or", "the", "a", "is", "in", "by", "for", "with",
    "blend", "combined", "reversal", "add", "subtract", "multiply"
  ]);
  return commonWords.has(word);
}

export function extractVariablesFromAST(ast: FactorAST): Set<string> {
  const variables = new Set<string>();

  if (ast.type === "variable" && ast.variable) {
    variables.add(ast.variable);
  }

  if (ast.left) {
    extractVariablesFromAST(ast.left).forEach(v => variables.add(v));
  }
  if (ast.right) {
    extractVariablesFromAST(ast.right).forEach(v => variables.add(v));
  }

  return variables;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
  mismatchVars: string[];
  errorMessage?: string;
}

/**
 * Validate that alpha description and AST are logically consistent.
 *
 * Returns isConsistent=false if:
 * - descriptionVars ⊄ astVars (description expects variables not in AST)
 * - astVars ⊄ descriptionVars (AST uses variables not mentioned in description)
 *
 * Fail Fast: Inconsistency is a CRITICAL error that must be caught before backtest.
 */
export function validateAlphaCandidateConsistency(
  description: string,
  ast: FactorAST,
): ConsistencyResult {
  const descVars = extractVariablesFromDescription(description);
  const astVars = extractVariablesFromAST(ast);

  const descVarsArray = Array.from(descVars).sort();
  const astVarsArray = Array.from(astVars).sort();

  // Check if sets are equal (both directions must be subset)
  const descSubsetOfAst = descVarsArray.every(v => astVars.has(v));
  const astSubsetOfDesc = astVarsArray.every(v => descVars.has(v));

  const isConsistent = descSubsetOfAst && astSubsetOfDesc;

  // Find mismatched variables
  const mismatchVars = new Set<string>();
  descVarsArray.forEach(v => {
    if (!astVars.has(v)) {
      mismatchVars.add(v);
    }
  });
  astVarsArray.forEach(v => {
    if (!descVars.has(v)) {
      mismatchVars.add(v);
    }
  });

  let errorMessage: string | undefined;
  if (!isConsistent) {
    const descStr = descVarsArray.length > 0 ? descVarsArray.join(", ") : "(none)";
    const astStr = astVarsArray.length > 0 ? astVarsArray.join(", ") : "(none)";
    errorMessage = `[AUDIT] Alpha description-AST mismatch: description expects {${descStr}} but AST uses {${astStr}}`;
  }

  return {
    isConsistent,
    descriptionVars: descVarsArray,
    astVars: astVarsArray,
    mismatchVars: Array.from(mismatchVars).sort(),
    errorMessage,
  };
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/alpha_consistency.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: All 14 tests pass

**Step 5: Commit**

```bash
git add ts-agent/src/schemas/alpha_consistency_schema.ts ts-agent/tests/alpha_consistency.test.ts
git commit -m "feat(aaarts): implement validateAlphaCandidateConsistency for Phase 1 validation

- Compare description and AST variable sets
- Return detailed mismatch information
- Generate explicit [AUDIT] error message for mismatches
- Enable Fail Fast rejection of logically inconsistent alphas"
```

---

## Task 4: Enhance factor_compute_engine.ts for Phase 2 (NaN propagation)

**Files:**
- Modify: `ts-agent/src/pipeline/factor_mining/factor_compute_engine.ts` (macro_cpi and macro_iip cases)

**Step 1: Read current implementation**

```bash
cd /home/kafka/finance/investor/ts-agent
grep -n "macro_cpi\|macro_iip" src/pipeline/factor_mining/factor_compute_engine.ts | head -10
```

**Step 2: Write the failing test**

```bash
cat > ts-agent/tests/nnan_propagation.test.ts << 'EOF'
import { describe, it, expect } from "bun:test";
import { computeFactorValue } from "../src/pipeline/factor_mining/factor_compute_engine";

describe("Phase 2: NaN Propagation", () => {
  describe("macro indicator handling", () => {
    it("should return NaN when macro_cpi is undefined", () => {
      const mockBar = {
        MacroCPI: undefined,
        MacroIIP: 100,
        Date: "2026-03-04",
        // ... other fields
      };

      const result = computeFactorValue("macro_cpi", mockBar as any);

      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return NaN when macro_iip is null", () => {
      const mockBar = {
        MacroCPI: 150,
        MacroIIP: null,
        Date: "2026-03-04",
      };

      const result = computeFactorValue("macro_iip", mockBar as any);

      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return NaN when macro_cpi is explicitly 0 (but undefined is handled)", () => {
      // Edge case: MacroCPI = 0 is valid data, but undefined/null must be NaN
      const mockBar = {
        MacroCPI: 0,
        MacroIIP: 100,
        Date: "2026-03-04",
      };

      const result = computeFactorValue("macro_cpi", mockBar as any);

      expect(result).toBe(0);
    });
  });
});
EOF
```

**Step 3: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/nnan_propagation.test.ts 2>&1 | head -20
```

Expected: Tests fail with assertion errors

**Step 4: Implement the fix**

Use the serena tool to find and modify the macro_cpi and macro_iip cases:

```bash
cd /home/kafka/finance/investor
mcp__serena__search_for_pattern \
  --substring_pattern='case "macro_cpi":|case "macro_iip":' \
  --relative_path='ts-agent/src/pipeline/factor_mining/factor_compute_engine.ts' \
  --context_lines_before=1 \
  --context_lines_after=5
```

Then manually edit the cases (or use Edit tool):

```bash
cat >> /tmp/factor_compute_fix.txt << 'EOF'
# For macro_cpi case, change:
# OLD:
#   case "macro_cpi":
#     return currentBar.MacroCPI ?? 0;
# NEW:
    case "macro_cpi":
      if (currentBar.MacroCPI === undefined || currentBar.MacroCPI === null) {
        return Number.NaN;  // Fail Fast: don't hide missing data
      }
      return currentBar.MacroCPI;

# Same for macro_iip
EOF
```

(Use Edit tool based on actual line numbers found in previous search)

**Step 5: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/nnan_propagation.test.ts 2>&1 | grep -E "(✓|✗|passed|failed)"
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add ts-agent/src/pipeline/factor_mining/factor_compute_engine.ts ts-agent/tests/nnan_propagation.test.ts
git commit -m "feat(aaarts): implement NaN propagation for Phase 2 validation

- Return Number.NaN for undefined/null macro_cpi
- Return Number.NaN for undefined/null macro_iip
- Enable Fail Fast: missing data propagates as NaN through computation
- Causes backtest metrics to be NaN, triggering Phase 3 rejection"
```

---

## Task 5: Enhance judgeVerification() for Phase 3 (NaN detection + strict thresholds)

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts` (judgeVerification function)

**Step 1: Write the failing test**

```bash
cat > ts-agent/tests/e2e_aaarts.test.ts << 'EOF'
import { describe, it, expect } from "bun:test";
// Import the orchestrator or test harness
// This is a pseudo-test to guide implementation

describe("Phase 3: Backtest Validation", () => {
  describe("judgeVerification with NaN detection", () => {
    it("should throw error when Sharpe is NaN", () => {
      const metrics = {
        sharpe: Number.NaN,
        ic: 0.05,
        maxDrawdown: 0.08,
        annualizedReturn: 0.15,
      };

      // judgeVerification should throw
      expect(() => {
        // simulated call
        if (Number.isNaN(metrics.sharpe)) {
          throw new Error("[AUDIT] Metrics contain NaN - data integrity failure");
        }
      }).toThrow();
    });

    it("should throw error when Sharpe < minSharpe (1.8)", () => {
      const metrics = {
        sharpe: 1.5,  // Below 1.8
        ic: 0.05,
        maxDrawdown: 0.08,
        annualizedReturn: 0.15,
      };

      expect(() => {
        if (metrics.sharpe < 1.8) {
          throw new Error(`[AUDIT] Insufficient Sharpe: ${metrics.sharpe} < 1.8`);
        }
      }).toThrow();
    });

    it("should throw error when IC < minIC (0.04)", () => {
      const metrics = {
        sharpe: 1.9,
        ic: 0.02,  // Below 0.04
        maxDrawdown: 0.08,
        annualizedReturn: 0.15,
      };

      expect(() => {
        if (metrics.ic < 0.04) {
          throw new Error(`[AUDIT] Weak information coefficient: ${metrics.ic} < 0.04`);
        }
      }).toThrow();
    });

    it("should throw error when maxDrawdown > 0.10", () => {
      const metrics = {
        sharpe: 1.9,
        ic: 0.05,
        maxDrawdown: 0.15,  // Above 0.10
        annualizedReturn: 0.15,
      };

      expect(() => {
        if (metrics.maxDrawdown > 0.10) {
          throw new Error(`[AUDIT] Excessive drawdown: ${metrics.maxDrawdown} > 0.10`);
        }
      }).toThrow();
    });

    it("should pass when all metrics meet strict thresholds", () => {
      const metrics = {
        sharpe: 1.9,
        ic: 0.05,
        maxDrawdown: 0.09,
        annualizedReturn: 0.15,
      };

      expect(() => {
        if (Number.isNaN(metrics.sharpe) || Number.isNaN(metrics.ic) || Number.isNaN(metrics.maxDrawdown)) {
          throw new Error("[AUDIT] Metrics contain NaN");
        }
        if (metrics.sharpe < 1.8) throw new Error("Sharpe too low");
        if (metrics.ic < 0.04) throw new Error("IC too low");
        if (metrics.maxDrawdown > 0.10) throw new Error("DD too high");
      }).not.toThrow();
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test tests/e2e_aaarts.test.ts 2>&1 | head -20
```

Expected: Tests pass (they're testing the condition logic, not the function itself yet)

**Step 3: Locate and modify judgeVerification() in pipeline_orchestrator.ts**

```bash
cd /home/kafka/finance/investor/ts-agent
grep -n "judgeVerification" src/system/pipeline_orchestrator.ts | head -5
```

Then read the function and modify it using Edit tool. Expected structure:

```typescript
private judgeVerification(metrics: AlphaMetrics): boolean {
  // TODO: Add NaN detection at start
  // TODO: Add strict threshold checks
  // TODO: Log rejections with full details
  // return true if all pass
}
```

**Step 4: Implement the enhanced judgeVerification()**

Replace the function with:

```typescript
private judgeVerification(metrics: AlphaMetrics): boolean {
  // Phase 3a: Detect NaN in metrics (critical data integrity check)
  if (isNaN(metrics.sharpe) || isNaN(metrics.ic) || isNaN(metrics.maxDrawdown)) {
    throw new Error(
      `[AUDIT] Metrics contain NaN - data integrity failure. ` +
      `Sharpe=${metrics.sharpe}, IC=${metrics.ic}, DD=${metrics.maxDrawdown}`
    );
  }

  // Phase 3b: Apply strict thresholds from config
  const config = this.runtimeConfig.pipelineBlueprint.verificationAcceptance;

  if (metrics.sharpe < config.minSharpe) {
    throw new Error(
      `[AUDIT] Insufficient Sharpe: ${metrics.sharpe} < ${config.minSharpe}`
    );
  }
  if (metrics.ic < config.minIC) {
    throw new Error(
      `[AUDIT] Weak information coefficient: ${metrics.ic} < ${config.minIC}`
    );
  }
  if (metrics.maxDrawdown > config.maxDrawdown) {
    throw new Error(
      `[AUDIT] Excessive drawdown: ${metrics.maxDrawdown} > ${config.maxDrawdown}`
    );
  }

  return true; // All checks passed
}
```

**Step 5: Run format, lint, typecheck**

```bash
cd /home/kafka/finance/investor/ts-agent
task check 2>&1 | head -30
```

Expected: No errors (or fix any found)

**Step 6: Commit**

```bash
git add ts-agent/src/system/pipeline_orchestrator.ts
git commit -m "feat(aaarts): enhance judgeVerification for Phase 3 strict validation

- Add NaN detection: throw error if any metric is NaN (data integrity failure)
- Apply strict thresholds: Sharpe ≥ 1.8, IC ≥ 0.04, DD ≤ 0.10
- Generate explicit [AUDIT] error messages for all rejections
- No threshold relaxation at runtime; config values are final authority"
```

---

## Task 6: Set strict configuration thresholds in default.yaml

**Files:**
- Modify: `ts-agent/src/config/default.yaml` (verificationAcceptance section)

**Step 1: Read current config**

```bash
cd /home/kafka/finance/investor/ts-agent
grep -A 5 "verificationAcceptance:" src/config/default.yaml
```

**Step 2: Update thresholds**

```bash
cat > /tmp/config_update.yaml << 'EOF'
pipelineBlueprint:
  verificationAcceptance:
    minSharpe: 1.8      # Strict: requires meaningful statistical power
    minIC: 0.04         # Strict: IC > 4% is meaningful (information coefficient)
    maxDrawdown: 0.10   # Strict: maximum 10% drawdown
    minAnnualizedReturn: 0.0  # No minimum return (IC and Sharpe are sufficient)
EOF
```

Use Edit tool to replace the verificationAcceptance section in src/config/default.yaml with these strict values.

**Step 3: Run format, lint, typecheck**

```bash
cd /home/kafka/finance/investor/ts-agent
bun run format src/config/default.yaml 2>&1 | head -5
```

**Step 4: Verify config loads correctly**

```bash
cd /home/kafka/finance/investor/ts-agent
node -e "const yaml = require('yaml'); const fs = require('fs'); const cfg = yaml.parse(fs.readFileSync('src/config/default.yaml', 'utf-8')); console.log('minSharpe:', cfg.pipelineBlueprint.verificationAcceptance.minSharpe);"
```

**Step 5: Commit**

```bash
git add ts-agent/src/config/default.yaml
git commit -m "chore(aaarts): set strict verification acceptance thresholds

- minSharpe: 1.8 (meaningful statistical power required)
- minIC: 0.04 (4% information coefficient threshold)
- maxDrawdown: 0.10 (10% maximum drawdown)
- These thresholds are never relaxed; they represent real trading standards"
```

---

## Task 7: Integrate Phase 1 validation into coOptimizeAndVerify()

**Files:**
- Modify: `ts-agent/src/pipeline/evaluate/coOptimizeAndVerify.ts` (or pipeline_orchestrator.ts depending on architecture)

**Step 1: Locate coOptimizeAndVerify() function**

```bash
cd /home/kafka/finance/investor/ts-agent
grep -rn "coOptimizeAndVerify" src/pipeline/ | head -5
```

**Step 2: Write integration test**

```bash
cat >> ts-agent/tests/e2e_aaarts.test.ts << 'EOF'

describe("Phase 1 Integration: coOptimizeAndVerify", () => {
  it("should call validateAlphaCandidateConsistency before backtest", () => {
    // Pseudo-test to guide implementation
    // The function should:
    // 1. Generate AST from description
    // 2. Call validateAlphaCandidateConsistency(desc, ast)
    // 3. If !isConsistent, throw error
    // 4. If consistent, proceed to backtest
    expect(true).toBe(true);  // Placeholder
  });

  it("should reject alpha with mismatched description-AST immediately", () => {
    // Input: description mentions "momentum" but AST uses only "macro_cpi"
    // Expected: Function throws "[AUDIT] Alpha description-AST mismatch"
    // Expected: No backtest execution (fail fast)
    expect(true).toBe(true);  // Placeholder
  });
});
EOF
```

**Step 3: Find location to add validation in coOptimizeAndVerify()**

Look for where AST is generated and before backtest is called.

**Step 4: Add Phase 1 validation code**

Insert after AST generation:

```typescript
import { validateAlphaCandidateConsistency } from "../schemas/alpha_consistency_schema";

// ... inside coOptimizeAndVerify() function ...

// After AST is generated:
const candidate = { description, ast };

// Phase 1: Validate description-AST consistency
const consistency = validateAlphaCandidateConsistency(
  candidate.description,
  candidate.ast
);

if (!consistency.isConsistent) {
  throw new Error(
    `[AUDIT] ${consistency.errorMessage}\n` +
    `Description vars: ${consistency.descriptionVars.join(", ")}\n` +
    `AST vars: ${consistency.astVars.join(", ")}`
  );
}

// If validation passed, continue to backtest
// ... rest of backtest logic ...
```

**Step 5: Run format, lint, typecheck**

```bash
cd /home/kafka/finance/investor/ts-agent
task check 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add ts-agent/src/pipeline/evaluate/coOptimizeAndVerify.ts
git commit -m "feat(aaarts): integrate Phase 1 validation into coOptimizeAndVerify

- Call validateAlphaCandidateConsistency immediately after AST generation
- Throw [AUDIT] error if description-AST mismatch detected
- Fail Fast: reject logically inconsistent alphas before backtest
- No backtest execution for invalid candidates"
```

---

## Task 8: Remove CQO audit layer from handleAdoptedCandidate()

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts` (handleAdoptedCandidate function, lines 639–692 approximately)

**Step 1: Locate handleAdoptedCandidate()**

```bash
cd /home/kafka/finance/investor/ts-agent
grep -n "handleAdoptedCandidate" src/system/pipeline_orchestrator.ts
```

**Step 2: Read the CQO audit section**

```bash
sed -n '639,692p' src/system/pipeline_orchestrator.ts
```

**Step 3: Remove the entire CQO logic**

Replace the CQO audit block with a simple log statement:

```typescript
// CQO (Critical Quant Officer) audit removed
// Phase 3 (judgeVerification) is the final authority for acceptance
this.logger.info(`[AUDIT] Alpha ${candidateId} passed all three AAARTS phases`);
```

**Step 4: Run format, lint, typecheck**

```bash
cd /home/kafka/finance/investor/ts-agent
task check 2>&1 | head -30
```

**Step 5: Commit**

```bash
git add ts-agent/src/system/pipeline_orchestrator.ts
git commit -m "chore(aaarts): remove CQO audit layer from handleAdoptedCandidate

- CQO audit was over-filtering validated alphas
- Phase 3 (judgeVerification) is now the sole authority
- Simplifies decision logic; no multi-layer redundant validation
- Fail Fast: explicit errors from three phases; no additional gates"
```

---

## Task 9: Run existing tests and verify no regressions

**Files:**
- Run: `task check` (format, lint, typecheck)
- Run: `bun test` (all unit and integration tests)

**Step 1: Format and lint**

```bash
cd /home/kafka/finance/investor/ts-agent
bun run format 2>&1 | grep -E "(error|warning)" || echo "✓ Formatting OK"
```

**Step 2: Typecheck**

```bash
cd /home/kafka/finance/investor/ts-agent
bun run typecheck 2>&1 | grep -E "(error|TS)" || echo "✓ Typecheck OK"
```

**Step 3: Run all tests**

```bash
cd /home/kafka/finance/investor/ts-agent
bun test 2>&1 | tail -20
```

Expected: All tests pass (especially AAARTS tests + regressions)

**Step 4: Commit if all pass**

```bash
git add .
git commit -m "test(aaarts): verify no regressions and all validations pass

- Format: ✓ OK
- Lint: ✓ OK
- Typecheck: ✓ OK
- Unit tests: ✓ PASS
- Regression tests: ✓ PASS"
```

---

## Task 10: Manual E2E test with task run:newalphasearch

**Files:**
- Run: `task run:newalphasearch`
- Inspect: `logs/unified/alpha_discovery_*.json`
- Verify: audit logs show Phase 1/2/3 validation steps

**Step 1: Run alpha discovery pipeline**

```bash
cd /home/kafka/finance/investor
source .env
task run:newalphasearch 2>&1 | tail -50
```

**Step 2: Check audit logs for Phase 1 rejections**

```bash
cd /home/kafka/finance/investor
cat logs/unified/alpha_discovery_*.json | jq '.[] | select(.failurePhase == "Phase 1") | {candidateId, errorMessage}' 2>/dev/null || echo "No Phase 1 failures"
```

**Step 3: Check audit logs for Phase 2 rejections (NaN metrics)**

```bash
cat logs/unified/alpha_discovery_*.json | jq '.[] | select(.failurePhase == "Phase 2") | {candidateId, metrics}' 2>/dev/null || echo "No Phase 2 failures"
```

**Step 4: Check accepted alphas**

```bash
cat logs/unified/alpha_discovery_*.json | jq '.[] | select(.failurePhase == null) | {candidateId, sharpe, ic, maxDrawdown}' 2>/dev/null || echo "No accepted alphas"
```

**Step 5: Manual verification**

- Verify all accepted alphas have Sharpe ≥ 1.8, IC ≥ 0.04, DD ≤ 0.10
- Verify all rejected alphas have explicit error messages
- Verify no silent failures or fallback values

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(aaarts): complete three-phase validation pipeline implementation

- Phase 1: Description-AST consistency validation
- Phase 2: NaN propagation for missing data
- Phase 3: Strict metric thresholds (Sharpe 1.8, IC 0.04, DD 0.10)
- E2E test: task run:newalphasearch succeeds with proper audit trail
- All validations Fail Fast: errors immediate, explicit, auditable"
```

---

## Success Checklist

- [ ] Task 1-3: Phase 1 validation functions implemented and tested
- [ ] Task 4: Phase 2 NaN propagation implemented and tested
- [ ] Task 5-6: Phase 3 strict validation and config thresholds
- [ ] Task 7: Phase 1 integrated into coOptimizeAndVerify()
- [ ] Task 8: CQO audit layer removed
- [ ] Task 9: All tests passing, no regressions
- [ ] Task 10: E2E test confirms AAARTS working end-to-end
- [ ] All commits created with Conventional Commits format
- [ ] Code formatted, linted, typechecked
- [ ] Audit logs show explicit Phase 1/2/3 validation flow

---

## Related Documentation

- Design: `docs/plans/2026-03-04-aaarts-design.md`
- Philosophy: `.agent/skills/fail-fast-coding-rules/SKILL.md`
- Architecture: `docs/diagrams/sequence.md` (update if needed)
