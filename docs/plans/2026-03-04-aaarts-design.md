# AAARTS Design: Alpha Authenticity & Reality-Truth System

**Date**: 2026-03-04
**Objective**: Implement a meaningful evaluation framework for alpha factors that enforces description-AST consistency and fails fast on logical inconsistencies.

---

## Executive Summary

AAARTS (Alpha Authenticity & Reality-Truth System) is a three-phase validation pipeline that ensures alpha factors are **logically consistent, computationally sound, and statistically validated** before execution. The system prioritizes:

1. **Logic Consistency** (Primary): Description ↔ AST alignment
2. **Data Integrity** (Secondary): NaN propagation for missing data
3. **Statistical Rigor** (Tertiary): Sharpe, IC, MaxDrawdown validation

Core principle: **Fail Fast** — errors are never hidden; systems must die immediately and honestly.

---

## Architecture

### Three-Phase Validation Pipeline

```
┌─────────────────────────────────────────────────┐
│ Phase 1: Description-AST Integrity              │
│ validateAlphaCandidateConsistency()             │
│ • Extract variables from description text       │
│ • Extract variables from AST                    │
│ • Compare: mismatch → throw error immediately  │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│ Phase 2: Calculation Execution                  │
│ evaluateFactorsViaEngine() + NaN propagation    │
│ • Execute AST on historical data                │
│ • Missing macro_cpi/macro_iip → return NaN      │
│ • NaN in computation → NaN in output            │
│ • NaN in backtest metrics → automatic reject    │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│ Phase 3: Backtest Validation                    │
│ judgeVerification() with strict thresholds      │
│ • Check: Sharpe ≥ 1.8, IC ≥ 0.04, DD ≤ 0.10   │
│ • Detect NaN metrics → throw error              │
│ • Reject weak signals immediately               │
└─────────────────────────────────────────────────┘
```

---

## Component Specifications

### Phase 1: Description-AST Integrity

**File**: `src/schemas/alpha_consistency_schema.ts`

**Function**: `validateAlphaCandidateConsistency(description: string, ast: FactorAST)`

```typescript
interface ConsistencyResult {
  isConsistent: boolean;
  descriptionVars: string[];
  astVars: string[];
  mismatchVars: string[];
  errorMessage?: string;
}
```

**Logic**:
- Extract variable names from description text (regex: `[a-z_]+\(` for function names)
- Extract variable names from AST (recursive traversal)
- Compare sets:
  - If `descriptionVars ⊂ astVars` or `astVars ⊂ descriptionVars`: **isConsistent = false**
  - Throw error: `"[AUDIT] Alpha description-AST mismatch: description expects {X} but AST uses {Y}"`

**Error behavior**: Exception propagates immediately; no fallback values.

### Phase 2: Calculation Execution with NaN Propagation

**File**: `src/pipeline/factor_mining/factor_compute_engine.ts`

**Strategy**: Return `Number.NaN` for missing macro indicators (instead of 0).

```typescript
case "macro_cpi":
  if (currentBar.MacroCPI === undefined || currentBar.MacroCPI === null) {
    return Number.NaN;  // Fail Fast: don't hide missing data
  }
  return currentBar.MacroCPI;

case "macro_iip":
  if (currentBar.MacroIIP === undefined || currentBar.MacroIIP === null) {
    return Number.NaN;  // Fail Fast: don't hide missing data
  }
  return currentBar.MacroIIP;
```

**Effect**: Any computation involving NaN produces NaN. Backtest metrics become NaN. Phase 3 detects and rejects.

### Phase 3: Backtest Validation with NaN Detection

**File**: `src/system/pipeline_orchestrator.ts` — `judgeVerification()`

```typescript
private judgeVerification(metrics: AlphaMetrics): boolean {
  // Phase 3a: Detect NaN in metrics
  if (isNaN(metrics.sharpe) || isNaN(metrics.ic) || isNaN(metrics.maxDrawdown)) {
    throw new Error(
      `[AUDIT] Metrics contain NaN - data integrity failure. ` +
      `Sharpe=${metrics.sharpe}, IC=${metrics.ic}, DD=${metrics.maxDrawdown}`
    );
  }

  // Phase 3b: Strict thresholds (from config)
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

**Error behavior**: Each failure is explicit and auditable. No relaxation of thresholds; no CQO override.

---

## Integration Points

### Integration 1: In `coOptimizeAndVerify()`

After AST generation, before backtest:

```typescript
// Phase 1 validation
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
// If exception, candidate is rejected immediately
```

### Integration 2: In `evaluateFactorsViaEngine()`

NaN propagation is automatic (computation engine returns NaN for undefined macro indicators).

### Integration 3: In `handleAdoptedCandidate()` → `judgeVerification()`

Metrics are validated strictly; any NaN or insufficient metric causes rejection.

**Removed**: CQO audit layer (lines 639–692). No additional filtering beyond Phase 3.

---

## Error Propagation Chain

```
Description ≠ AST (Phase 1)
    ↓ throw Error
    ↓
coOptimizeAndVerify() catches
    ↓
Candidate rejected
    ↓
Exception logged in audit_trail
    ↓
Next candidate evaluated
```

Example error log:
```json
{
  "timestamp": "2026-03-04T10:30:45Z",
  "candidateId": "alpha_20260304_001",
  "failurePhase": "Phase 1",
  "severity": "CRITICAL",
  "errorMessage": "[AUDIT] Alpha description-AST mismatch detected",
  "details": {
    "description": "volatility reversal + momentum blend",
    "descriptionVars": ["volatility", "momentum"],
    "astVars": ["macro_cpi"],
    "mismatchVars": ["volatility", "momentum"]
  }
}
```

---

## Testing Strategy

### Test 1: Description-AST Mismatch Detection
- Input: description with volatility/momentum; AST with macro_cpi
- Expected: isConsistent=false, error thrown, candidate rejected
- File: `tests/alpha_consistency.test.ts`

### Test 2: NaN Propagation
- Input: missing macro_cpi data
- Expected: factor engine returns NaN, backtest metrics are NaN, Phase 3 rejects
- File: `tests/nnan_propagation.test.ts` (new)

### Test 3: End-to-End Validation Pipeline
- Input: invalid candidate
- Expected: coOptimizeAndVerify() → validateAlphaCandidateConsistency() → exception → audit log
- File: `tests/e2e_aaarts.test.ts` (new)

### Test 4: Regression (Passing Alphas)
- Input: previously passing alphas
- Expected: all three phases pass, metrics exceed thresholds
- File: existing integration tests

---

## Configuration

**File**: `src/config/default.yaml`

```yaml
pipelineBlueprint:
  verificationAcceptance:
    minSharpe: 1.8      # Strict: requires meaningful statistical power
    minIC: 0.04         # Strict: IC > 4% is meaningful
    maxDrawdown: 0.10   # Strict: maximum 10% drawdown
    minAnnualizedReturn: 0.0  # No minimum return (other metrics sufficient)
```

These are **never relaxed**. An alpha that doesn't meet these thresholds is rejected with explicit error message.

---

## Fail Fast Principles

1. **No Fallback Values**: Missing data → NaN (not 0), not defaults
2. **Immediate Failure**: Logic inconsistencies throw immediately (not warnings)
3. **Explicit Errors**: All rejections logged with full details
4. **No Silent Failures**: Metrics that can't be computed → exception (not NaN silently returned)

---

## Success Criteria

✓ Description-AST mismatches detected before backtest
✓ Missing macro indicators fail fast (NaN propagation)
✓ All alpha rejections are explicitly auditable
✓ Previously passing alphas continue to pass
✓ Configuration thresholds are never relaxed at runtime
✓ No CQO override layer; Phase 3 is final authority

---

## Related Files

- `src/schemas/alpha_consistency_schema.ts` — Phase 1 validation
- `src/pipeline/factor_mining/factor_compute_engine.ts` — Phase 2 NaN handling
- `src/system/pipeline_orchestrator.ts` — Phase 3 judgeVerification & integration
- `src/config/default.yaml` — Strict configuration thresholds
- `tests/alpha_consistency.test.ts` — Phase 1 tests
- `.agent/skills/fail-fast-coding-rules/SKILL.md` — Project philosophy
