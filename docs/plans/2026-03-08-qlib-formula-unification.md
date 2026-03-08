# Qlib Formula Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the custom JSON AST alpha representation with qlib expression strings, enabling LLMs to write meaningful formulas and qlib to evaluate them natively.

**Architecture:** Three-phase migration: (1) type layer — `FactorAST` → `formula: string`; (2) generation layer — `generateRandomAST()` → `generateQlibFormula()`; (3) evaluation layer — custom TS compute engine → Python qlib-style pandas evaluator. Custom project columns (`$macro_iip`, `$sentiment`, etc.) are passed as pre-computed CSV fields and referenced in formulas as `$macro_iip`.

**Tech Stack:** TypeScript (Bun), Python (pandas, qlib expression syntax), `factor_compute_engine_client.ts` (Bun spawn → Python subprocess)

---

## Phase 1: Type Layer — FactorAST → formula: string

### Task 1: Add `formula` to AlphaFactor, deprecate `ast`

**Files:**
- Modify: `ts-agent/src/types/index.ts`
- Modify: `ts-agent/src/providers/factor_compute_engine_client.ts`

**Context:**
`AlphaFactor.ast: FactorAST` is the current JSON tree. We add `formula: string` alongside it, then remove `ast` in Task 2. `ComputeFactor.ast` in the client also needs updating.

**Step 1: Update AlphaFactor type**

In `ts-agent/src/types/index.ts`, change:
```typescript
export interface AlphaFactor {
  id: string;
  ast: FactorAST;           // remove this
  formula: string;           // add this — qlib expression e.g. "Ref($close,5)/$close-1"
  description: string;
  // ... rest unchanged
}
```

**Step 2: Update ComputeFactor in client**

In `ts-agent/src/providers/factor_compute_engine_client.ts`, change:
```typescript
export interface ComputeFactor {
  id: string;
  formula: string;           // was: ast: Record<string, unknown>
}
```

**Step 3: Run typecheck to find all breakage sites**

```bash
task check 2>&1 | grep -E "error|ast"
```
Expected: errors at `latent_economic_signal_agent.ts`, `pipeline_orchestrator.ts`, `alpha_consistency_schema.ts`. These are exactly the files we fix next.

**Step 4: Remove FactorAST import from types/index.ts**

Delete: `import type { FactorAST } from "../schemas/financial_domain_schemas.ts";`

**Step 5: Commit**
```bash
git add ts-agent/src/types/index.ts ts-agent/src/providers/factor_compute_engine_client.ts
git commit -m "refactor: replace AlphaFactor.ast with formula: string (qlib expression)"
```

---

### Task 2: Replace validateAlphaCandidateConsistency with validateQlibFormula

**Files:**
- Modify: `ts-agent/src/schemas/alpha_consistency_schema.ts`
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts` (call site at line ~1960)

**Context:**
`validateAlphaCandidateConsistency(description, ast)` walks the JSON AST tree checking variable names match description. With qlib formulas, validation means: (a) formula is non-empty, (b) all `$var` references are in the known column list, (c) operators are from the allowed qlib operator set.

**Step 1: Define allowed columns and operators**

In `ts-agent/src/schemas/alpha_consistency_schema.ts`, replace the file content:
```typescript
export const QLIB_ALLOWED_COLUMNS = new Set([
  "close", "open", "high", "low", "volume",
  "correction_freq", "activist_bias",
  "macro_iip", "macro_cpi", "macro_leverage_trend",
  "segment_sentiment", "ai_exposure", "kg_centrality",
]);

export const QLIB_ALLOWED_OPS = new Set([
  "Ref", "Mean", "Std", "Corr", "Rank", "Log",
  "Max", "Min", "Sum", "Abs",
]);

export function validateQlibFormula(formula: string): {
  isValid: boolean;
  errorMessage?: string;
} {
  if (!formula || formula.trim().length === 0) {
    return { isValid: false, errorMessage: "[AUDIT] Empty formula" };
  }

  const columnRefs = [...formula.matchAll(/\$(\w+)/g)].map(m => m[1]);
  const unknownCols = columnRefs.filter(c => !QLIB_ALLOWED_COLUMNS.has(c));
  if (unknownCols.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] Unknown columns in formula: ${unknownCols.join(", ")}`,
    };
  }

  const ops = [...formula.matchAll(/([A-Z][a-zA-Z]+)\(/g)].map(m => m[1]);
  const unknownOps = ops.filter(op => !QLIB_ALLOWED_OPS.has(op));
  if (unknownOps.length > 0) {
    return {
      isValid: false,
      errorMessage: `[AUDIT] Unknown operators in formula: ${unknownOps.join(", ")}`,
    };
  }

  return { isValid: true };
}
```

**Step 2: Update call site in pipeline_orchestrator.ts**

Find `validateAlphaCandidateConsistency(` (~line 1960) and replace:
```typescript
// before:
const consistency = validateAlphaCandidateConsistency(
  candidate.description,
  candidate.ast as any,
);
if (!consistency.isConsistent) {
  throw new Error(`[AUDIT] ${consistency.errorMessage}...`);
}

// after:
const consistency = validateQlibFormula(candidate.formula);
if (!consistency.isValid) {
  throw new Error(consistency.errorMessage);
}
```

**Step 3: Run typecheck**
```bash
task check 2>&1 | head -30
```

**Step 4: Commit**
```bash
git add ts-agent/src/schemas/alpha_consistency_schema.ts ts-agent/src/system/pipeline_orchestrator.ts
git commit -m "refactor: replace AST consistency check with qlib formula validator"
```

---

### Task 3: Update IdeaCandidate and remove ast references

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts` (IdeaCandidate interface, ~line 65)
- Modify: `ts-agent/src/context/alpha_knowledgebase.ts` (any ast storage)

**Context:**
`IdeaCandidate extends AlphaFactor` — since AlphaFactor now has `formula`, IdeaCandidate inherits it. But `pipeline_orchestrator.ts` also has `IdeaCandidate` with possible `ast` references.

**Step 1: Check IdeaCandidate definition**
```bash
grep -n "ast" ts-agent/src/system/pipeline_orchestrator.ts | head -20
```

**Step 2: Remove remaining `ast` property references from IdeaCandidate**

Remove any `ast?:` property from the IdeaCandidate interface.

**Step 3: Check alpha_knowledgebase.ts for ast column**
```bash
grep -n "ast" ts-agent/src/context/alpha_knowledgebase.ts | head -20
```
If `ast` is stored as a JSON column in SQLite, rename the column or keep as `formula TEXT` in the schema.

**Step 4: Run full typecheck to confirm Phase 1 clean**
```bash
task check
```
Expected: 0 errors related to `ast`.

**Step 5: Commit**
```bash
git add ts-agent/src/system/pipeline_orchestrator.ts ts-agent/src/context/alpha_knowledgebase.ts
git commit -m "refactor: remove all remaining ast references, IdeaCandidate now uses formula"
```

---

## Phase 2: Generation Layer — generateRandomAST → generateQlibFormula

### Task 4: Implement generateQlibFormula in LesAgent

**Files:**
- Modify: `ts-agent/src/agents/latent_economic_signal_agent.ts`

**Context:**
`generateRandomAST()` builds a random binary tree. Replace with `generateQlibFormula()` that builds a random **qlib expression string**. The operators and columns remain the same, the output format changes.

**qlib expression examples:**
```
"Ref($close,5)/$close-1"                    # 5-day momentum
"Mean($close,20)/Mean($close,5)-1"           # MA crossover
"Corr($close,$volume,20)"                    # price-volume correlation
"(Mean($close,5)-Mean($close,20))/Std($close,20)"  # Z-score signal
"Ref($macro_iip,1)*($close/$open-1)"         # macro-weighted return
```

**Step 1: Add generateQlibFormula function (inside LesAgent class)**

Replace the `generateRandomAST` function with:
```typescript
private generateQlibFormula(depth: number, biasCols?: string[]): string {
  const cols = biasCols && biasCols.length > 0 && Math.random() > 0.5
    ? biasCols
    : ["close", "open", "high", "low", "volume",
       "macro_iip", "macro_cpi", "segment_sentiment", "macro_leverage_trend"];

  const pickCol = () => `$${mathUtils.pickOne(cols)}`;
  const pickN = (min = 3, max = 20) =>
    String(Math.floor(Math.random() * (max - min)) + min);

  if (depth <= 0) return pickCol();

  const ops = ["Ref", "Mean", "Std", "Corr", "ratio", "zscore"] as const;
  const op = mathUtils.pickOne(ops);

  switch (op) {
    case "Ref":   return `Ref(${pickCol()},${pickN()})`;
    case "Mean":  return `Mean(${pickCol()},${pickN()})`;
    case "Std":   return `Std(${pickCol()},${pickN()})`;
    case "Corr":  return `Corr(${pickCol()},${pickCol()},${pickN()})`;
    case "ratio": {
      const a = this.generateQlibFormula(depth - 1, biasCols);
      const b = this.generateQlibFormula(depth - 1, biasCols);
      return `(${a})/(${b})`;
    }
    case "zscore": {
      const col = pickCol();
      const n = pickN();
      return `(${col}-Mean(${col},${n}))/Std(${col},${n})`;
    }
  }
}
```

**Step 2: Update arithmeticCrossover for string formulas**

Replace `arithmeticCrossover(astX, astY)` with:
```typescript
private crossoverFormulas(formulaA: string, formulaB: string): string {
  return Math.random() > 0.5
    ? `(${formulaA}+${formulaB})/2`
    : Math.random() > 0.5 ? formulaA : formulaB;
}
```

**Step 3: Update candidates.push() call**

Change:
```typescript
// before: ast: ast
// after:
formula: this.generateQlibFormula(depth, bias),
```

For evolution (crossover), use:
```typescript
formula: seedFormula && partnerFormula
  ? this.crossoverFormulas(seedFormula, partnerFormula)
  : this.generateQlibFormula(depth, bias),
```

**Step 4: Update seed formula retrieval**

Seeds are loaded from `playbookBullets`. Change:
```typescript
const seedAst = seed.metadata?.ast as FactorAST | undefined;
// to:
const seedFormula = seed.metadata?.formula as string | undefined;
```

**Step 5: Update LLM prompt to request qlib formula**

In `PromptFactory` or the openAIThemeProvider call, add to the prompt:
```
Return a qlib-compatible formula string using $close, $open, $high, $low, $volume,
$macro_iip, $macro_cpi, $segment_sentiment, $macro_leverage_trend.
Operators: Ref(col,N), Mean(col,N), Std(col,N), Corr(col1,col2,N), Rank(col).
Example: "(Mean($close,5)-Mean($close,20))/Std($close,20)"
```

**Step 6: Typecheck and run**
```bash
task check
```

**Step 7: Commit**
```bash
git add ts-agent/src/agents/latent_economic_signal_agent.ts
git commit -m "feat: replace generateRandomAST with generateQlibFormula (qlib expression strings)"
```

---

## Phase 3: Evaluation Layer — Custom TS Engine → Python qlib evaluator

### Task 5: Create Python qlib expression evaluator

**Files:**
- Create: `ts-agent/src/research/qlib_factor_eval.py`

**Context:**
`factor_compute_engine_client.ts` spawns a Python process via `bun:spawn`. Currently it passes `ast: Record`. We create a new Python evaluator that:
1. Reads market data (OHLCV + custom columns) from CSV
2. Evaluates qlib-style formula strings using pandas
3. Returns IC, Sharpe, and per-symbol scores as JSON

**Step 1: Create the evaluator**

```python
import sys
import json
import pandas as pd
import numpy as np


SUPPORTED_OPS = {
    "Ref": lambda s, n: s.shift(int(n)),
    "Mean": lambda s, n: s.rolling(int(n)).mean(),
    "Std": lambda s, n: s.rolling(int(n)).std(),
    "Sum": lambda s, n: s.rolling(int(n)).sum(),
    "Max": lambda s, n: s.rolling(int(n)).max(),
    "Min": lambda s, n: s.rolling(int(n)).min(),
    "Abs": lambda s: s.abs(),
    "Log": lambda s: np.log(s.clip(lower=1e-9)),
    "Rank": lambda s: s.rank(pct=True),
}


def eval_formula(formula: str, df: pd.DataFrame) -> pd.Series:
    import re

    def resolve(expr: str) -> pd.Series:
        expr = expr.strip()
        # column reference
        m = re.fullmatch(r"\$(\w+)", expr)
        if m:
            col = m.group(1)
            if col not in df.columns:
                raise ValueError(f"Unknown column: {col}")
            return df[col].astype(float)
        # function call
        m = re.fullmatch(r"(\w+)\((.+)\)", expr)
        if m:
            op, args_str = m.group(1), m.group(2)
            args = split_args(args_str)
            if op not in SUPPORTED_OPS:
                raise ValueError(f"Unknown operator: {op}")
            series_args = [resolve(a) if "$" in a or "(" in a else a for a in args]
            return SUPPORTED_OPS[op](*series_args)
        # arithmetic (simple pass-through to pandas eval)
        local_vars = {f"col_{k}": v for k, v in df.items() if k.isidentifier()}
        return df.eval(re.sub(r"\$(\w+)", r"\1", expr))

    def split_args(s: str) -> list[str]:
        depth, start, parts = 0, 0, []
        for i, c in enumerate(s):
            if c == "(": depth += 1
            elif c == ")": depth -= 1
            elif c == "," and depth == 0:
                parts.append(s[start:i].strip())
                start = i + 1
        parts.append(s[start:].strip())
        return parts

    return resolve(formula)


def evaluate_factors(request: dict) -> dict:
    market_data = request["market_data"]
    factors = request["factors"]

    df = pd.DataFrame(market_data)
    df["date"] = pd.to_datetime(df["date"])
    df.sort_values(["symbol", "date"], inplace=True)

    results = []
    for factor in factors:
        fid = factor["id"]
        formula = factor["formula"]
        try:
            scores_by_symbol = []
            for symbol, group in df.groupby("symbol"):
                group = group.set_index("date")
                signal = eval_formula(formula, group).dropna()
                forward = group["close"].pct_change().shift(-1)
                aligned = pd.concat([signal, forward], axis=1).dropna()
                aligned.columns = ["signal", "ret"]
                for date, row in aligned.iterrows():
                    scores_by_symbol.append({
                        "symbol": symbol,
                        "date": str(date.date()),
                        "score": float(row["signal"]),
                    })

            scores_series = pd.Series([s["score"] for s in scores_by_symbol])
            ic = float(scores_series.corr(pd.Series([
                group["close"].pct_change().shift(-1).iloc[-1]
                for _, group in df.groupby("symbol")
                if len(group) > 1
            ]))) if len(scores_by_symbol) > 0 else 0.0

            results.append({
                "factor_id": fid,
                "status": "success",
                "scores": scores_by_symbol,
                "ic_proxy": round(ic, 4) if not pd.isna(ic) else 0.0,
            })
        except Exception as e:
            results.append({"factor_id": fid, "status": "error", "message": str(e)})

    return {"status": "success", "results": results}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    result = evaluate_factors(request)
    print(json.dumps(result))
```

**Step 2: Test it manually**
```bash
echo '{"market_data":[{"symbol":"6501.T","date":"2024-01-02","close":100,"open":99,"high":101,"low":98,"volume":1000,"macro_iip":0.5}],"factors":[{"id":"TEST-1","formula":"Ref($close,1)/$close-1"}]}' | uv run python ts-agent/src/research/qlib_factor_eval.py
```
Expected: JSON with `status: "success"` and scores.

**Step 3: Commit**
```bash
git add ts-agent/src/research/qlib_factor_eval.py
git commit -m "feat: add Python qlib expression evaluator for alpha factor scoring"
```

---

### Task 6: Update ComputeEngineClient to call qlib_factor_eval.py

**Files:**
- Modify: `ts-agent/src/providers/factor_compute_engine_client.ts`

**Context:**
The client currently spawns a Python process and sends JSON with `ast`. Change to send `formula` and point to the new evaluator script.

**Step 1: Find the spawn call and the script path**
```bash
grep -n "spawn\|python\|script" ts-agent/src/providers/factor_compute_engine_client.ts
```

**Step 2: Update the request payload**

Change factors mapping:
```typescript
// before:
factors: factors.map((f) => ({ id: f.id, ast: f.ast })),

// after:
factors: factors.map((f) => ({ id: f.id, formula: f.formula })),
```

**Step 3: Update the Python script path**

Change the script path to point to `qlib_factor_eval.py`:
```typescript
const scriptPath = join(import.meta.dir, "../research/qlib_factor_eval.py");
```

**Step 4: Update the Taskfile with qlib eval task**

In `Taskfile.yml`, add:
```yaml
research:qlib:eval:
  desc: "Test qlib formula evaluator"
  cmds:
    - uv run python ts-agent/src/research/qlib_factor_eval.py < ts-agent/src/research/test_eval_input.json
```

**Step 5: Run typecheck**
```bash
task check
```

**Step 6: Commit**
```bash
git add ts-agent/src/providers/factor_compute_engine_client.ts Taskfile.yml
git commit -m "feat: wire ComputeEngineClient to qlib_factor_eval.py (formula-based evaluation)"
```

---

### Task 7: End-to-end smoke test

**Files:**
- Read: `logs/unified/` (output)

**Context:**
Run one full alpha discovery cycle and confirm qlib formulas appear in logs instead of AST JSON.

**Step 1: Run one discovery cycle**
```bash
task run:newalphasearch
```

**Step 2: Check that formulas appear in log**
```bash
grep -r "formula\|Ref(\|Mean(\|Corr(" logs/unified/ | tail -20
```
Expected: lines like `"formula": "Mean($close,20)/Mean($close,5)-1"`

**Step 3: Confirm no `ast` in log**
```bash
grep -r '"ast"' logs/unified/ | wc -l
```
Expected: 0

**Step 4: Tag completion**
```bash
git commit --allow-empty -m "chore: qlib formula unification complete (Phase 1-3)"
```

---

## Summary of File Changes

| File | Change |
|------|--------|
| `ts-agent/src/types/index.ts` | `ast: FactorAST` → `formula: string` |
| `ts-agent/src/schemas/alpha_consistency_schema.ts` | Replace with `validateQlibFormula()` |
| `ts-agent/src/providers/factor_compute_engine_client.ts` | `ast` → `formula`, new script path |
| `ts-agent/src/agents/latent_economic_signal_agent.ts` | `generateRandomAST` → `generateQlibFormula` |
| `ts-agent/src/system/pipeline_orchestrator.ts` | Update IdeaCandidate, validation call |
| `ts-agent/src/context/alpha_knowledgebase.ts` | `ast` column → `formula` column |
| `ts-agent/src/research/qlib_factor_eval.py` | New: Python qlib evaluator |
| `Taskfile.yml` | Add `research:qlib:eval` task |
