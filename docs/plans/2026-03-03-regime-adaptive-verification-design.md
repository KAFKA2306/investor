# Design Document: Regime-Adaptive Verification Acceptance

**Date**: 2026-03-03
**Author**: Antigravity + User (Brainstorming Session)
**Status**: ✅ Design Approved

---

## Executive Summary

This document outlines the transition from hard-coded alpha adoption criteria (Sharpe > 1.8, IC > 0.04) to a **dynamically adjusted** system that adapts to market regimes (RISK_ON / NEUTRAL / RISK_OFF) as identified by the `StateMonitor`.

### Problem Statement
- In unstable market conditions (RISK_OFF), the baseline Sharpe 1.8 threshold is often excessively high, causing the system to reject valid alpha signals that would be effective in that environment.
- Conversely, risk management metrics (MaxDrawdown) must remain strictly enforced regardless of market conditions to preserve capital.

### Solution
**Multiplier-based Regime Adaptation**: Baseline metrics are derived from historical performance data and then adjusted by regime-specific multipliers (ranging from 0.35 to 1.1).

---

## 1. Architecture

### 1.1 Design Pattern: Multiplier-Based Adaptation

```yaml
verificationAcceptance:
  # Baseline: Derived from historical performance (via bootstrap_baseline.ts)
  baseline:
    minSharpe: 1.0           
    minIC: 0.02              
    maxDrawdown: 0.1         # Fixed (Regime independent)
    minAnnualizedReturn: 0.0

  # Regime Adaptation Settings
  regimeAdaptation:
    enabled: true

    # Multipliers applied per regime:
    # Effective Threshold = baseline × multiplier
    multipliers:
      RISK_ON:
        sharpe: 1.1          # 1.0 × 1.1 = 1.1
        ic: 1.0              # 0.02 × 1.0 = 0.02

      NEUTRAL:
        sharpe: 0.9          # 1.0 × 0.9 = 0.9
        ic: 0.8              # 0.02 × 0.8 = 0.016

      RISK_OFF:
        sharpe: 0.35         # 1.0 × 0.35 = 0.35
        ic: 0.25             # 0.02 × 0.25 = 0.005
```

### 1.2 Key Principles

| Principle | Implementation | Rationale |
|---|---|---|
| **Evidence-Based Baselines** | Calculated from logs via `bootstrap_baseline.ts`. | Ensures targets are grounded in real-world performance, not theory. |
| **Fixed Risk Limits** | MaxDrawdown held at 0.1 regardless of regime. | Risk management must be absolute and independent of market sentiment. |
| **Relative Adjustment** | Regime adaptation applied only to Sharpe and IC. | Multipliers offer an intuitive way to model "relative difficulty" per regime. |
| **Unified Signaling** | Utilizing RISK_ON/OFF from `StateMonitor`. | Minimizes integration costs by leveraging existing sensor infrastructure. |

### 1.3 Data Flow

```
StateMonitor
  ├─ Continuous broadcast of RISK_ON / NEUTRAL / RISK_OFF
  ↓
CqoAgent.auditStrategy(outcome, regime)
  ├─ Invokes LesAgent.computeEffectiveCriteria(config, regime)
  ├─ Calculates effective thresholds (baseline × multiplier[regime])
  ├─ Determines GO/HOLD/PIVOT using adapted thresholds
  ↓
Audit Logging
  ├─ Record the regime used for the audit
  ├─ Record applied threshold values
  ├─ Record audit verdict
  ↓
Monthly Optimization (Phase D)
  ├─ Aggregate performance of Alphas promoted during RISK_OFF
  ├─ Optimize multiplier values
  ├─ Propose recommended configuration updates
```

---

## 2. Implementation Details

### 2.1 Component Changes

- `config/default.yaml`: Extend `verificationAcceptance` to include baselines and multipliers.
- `ts-agent/src/schemas/verification.ts`: Update Zod schemas to validate the new structure.
- `ts-agent/src/agents/les_agent.ts`: Replace static `EVALUATION_CRITERIA` with `computeEffectiveCriteria()`.
- `ts-agent/src/agents/chief_quant_officer_agent.ts`: Add `regime` as an optional parameter to `auditStrategy()`.
- `ts-agent/src/system/app_runtime_core.ts`: Add optional regime context to `BaseAgent`.
- `ts-agent/src/tools/bootstrap_baseline.ts`: **New** Tool for log analysis and baseline calculation.

---

## 3. Rollout Strategy

### Phase A: Bootstrapping (1-2 Days)
1. Run `task bootstrap:baseline`.
2. Manual review of recommended baseline values.
3. Integrate into `config/default.yaml`.

### Phase B: Dry-Run & Back-Audit (3-5 Days)
1. Re-audit historical successes/failures using the new thresholds.
2. Visualize shifts in verdicts (Changes in GO/HOLD/PIVOT calls).
3. Validate that shifts align with human expectations of regime logic.

### Phase C: Live Deployment
1. Deploy configuration to production.
2. Initiate search loop via `task run:newalphasearch`.
3. Monitor audit logs for consistency.

### Phase D: Continuous Learning (3 Months+)
1. Monthly log aggregation to analyze success rates per regime.
2. Quarterly multiplier refinement based on realized performance.

---

## 4. Testing & Validation

- **Unit**: Verify `computeEffectiveCriteria()` provides mathematically accurate results.
- **Integration**: Ensure `StateMonitor` correctly propagates signals to the `CqoAgent`.
- **Validation**: Perform "Back-Audit" comparison to ensure the new policy reduces false negatives in RISK_OFF environments without increasing MaxDrawdown violations.

---

## 5. Success Criteria

- Successfully visualize regime-based shifts in the Back-Audit phase. 
- Maintain MaxDrawdown within the fixed 0.1 limit across all adopted Alphas.
- Achieve a measurable increase in the number of high-quality Alphas identified during RISK_OFF regimes compared to the hard-coded baseline.
