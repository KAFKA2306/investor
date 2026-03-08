# AAARTS Implementation Plan

**Goal**: Implement a three-phase validation pipeline (Description-AST consistency → NaN propagation → strict metric validation) that enforces **Fail Fast** principles and prevents logically inconsistent alphas from entering the backtest.

**Architecture**:
- **Phase 1**: Validates that alpha descriptions match their AST implementations (extracting and comparing variable sets).
- **Phase 2**: Propagates `NaN` for missing macro indicators (CPI, IIP) to ensure data integrity issues fail fast.
- **Phase 3**: Detects `NaN` metrics and applies strict thresholds (Sharpe 1.8, IC 0.04, DD 0.10).

**Mapping to Audit Guidelines**: All rejections in Ph1-Ph3 MUST map to categories in [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md).

---

## Task 1: Phase 1 - Logical Consistency (Description-AST)

### 1.1 Variable Extraction
Implement `extractVariablesFromDescription` and `extractVariablesFromAST` in `ts-agent/src/schemas/alpha_consistency_schema.ts`.
- **Logic**: Use regex for description and recursive tree traversal for AST.
- **Goal**: Identify discrepancies between what the agent says it's doing and what the code actually does.

### 1.2 Consistency Validator
Implement `validateAlphaCandidateConsistency`.
- **Verdict**: If mismatch detected, throw error: `[AUDIT] Alpha description-AST mismatch`. Map to **1. Interpretation Consistency**.

---

## Task 2: Phase 2 - Data Integrity (NaN Propagation)

### 2.1 Macro Handling in Compute Engine
Modify `ts-agent/src/pipeline/factor_mining/factor_compute_engine.ts`.
- **Logic**: For `macro_cpi` and `macro_iip`, return `Number.NaN` if data is undefined or null.
- **Goal**: Ensure that missing data is not hidden by fallback values (Fail Fast). Map to **5. Data Integrity**.

---

## Task 3: Phase 3 - Statistical Rigor (Backtest Validation)

### 3.1 Strict Threshold Validator
Modify `judgeVerification` in `ts-agent/src/system/pipeline_orchestrator.ts`.
- **Checks**: 
  - If any metric (Sharpe, IC, DD) is `NaN`, throw integrity error (Map to **5. Data Integrity**).
  - If Sharpe < 1.8, IC < 0.04, or DD > 0.10, throw threshold error (Map to **3. Metric Thresholds**).
- **Goal**: Enforce non-negotiable performance gates.

---

## Task 4: Integration & Audit Trail

Integrate Phase 1 into `coOptimizeAndVerify()` and Phase 3 into the final adoption loop. Ensure all `AuditReport` objects include the standard reason code from [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md).

---

## Verification Plan

### Automated Tests
- `ts-agent/tests/alpha_consistency.test.ts`: Verify mismatch detection.
- `ts-agent/tests/nnan_propagation.test.ts`: Verify that missing macro data leads to backtest failure.
- `ts-agent/tests/e2e_aaarts.test.ts`: End-to-end audit check.

### Manual Verification
- Review generated `audit_trail.json` to ensure rejection reasons are correctly mapped.
