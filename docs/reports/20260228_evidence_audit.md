# Evidence Audit Report (2026-02-28)

## Scope
- Target: `ts-agent/src/**`
- Protocol: `evidence_audit` (Potemkin Metrics / Linguistic Fraud / Lineage Break)

## Findings
1. CLOSED (Critical): Potemkin KPI override in NVDA experiment
- Evidence:
  - `annualizedReturn` / `sharpeRatio` fixed assignment was present in `05_nvda_alpha.ts`.
- Remediation:
  - Removed fixed KPI overwrite; now outcome depends on `calculateOutcome` only.
  - Ref: `ts-agent/src/experiments/05_nvda_alpha.ts:69`

2. CLOSED (High): UQTL lineage split between EventStore and MemoryCenter
- Evidence:
  - `BaseAgent.emitEvent` wrote only to EventStore, while dashboard/API read from MemoryCenter ledger.
- Remediation:
  - Added mirrored write to `MemoryCenter.pushEvent` inside `emitEvent`.
  - Ref: `ts-agent/src/core/index.ts:125`

3. CLOSED (High): MemoryCenter DB path inconsistency by working directory
- Evidence:
  - `logs/memory.sqlite` location changed depending on cwd (`/investor` vs `/investor/ts-agent`).
- Remediation:
  - Normalized default path to repo-root `logs/memory.sqlite`.
  - Ref: `ts-agent/src/core/memory_center.ts:37`

4. CLOSED (Medium): Template outcome could emit implicit mock uplift
- Evidence:
  - Generic scenario used fixed uplift heuristic and did not force evidence tagging.
- Remediation:
  - Added `evidenceSource` / `experimentId` plumbing.
  - Removed implicit uplift constant; now explicit input only.
  - Ref: `ts-agent/src/experiments/scenarios/generic_alpha_scenario.ts:11`

5. CLOSED (Medium): PEAD metrics not consistently history-derived
- Evidence:
  - Sharpe/annualized/drawdown path was partially formula-based and not unified to returns history.
- Remediation:
  - Recomputed t-stat/p-value/sharpe/annualized/max drawdown from `returnsHistory`.
  - Added `evidenceSource` to outcome.
  - Ref: `ts-agent/src/agents/pead.ts:93`

6. CLOSED (Medium): Metagame scenario used rough significance placeholders
- Evidence:
  - `tStat` and `pValue` were rough/fixed placeholders.
- Remediation:
  - Switched to data-derived `tStat`, `pValue`, `cumulativeReturn`, `maxDrawdown`.
  - Ref: `ts-agent/src/experiments/metagame_anomaly_verification.ts:112`

7. ACCEPTED RISK (Low): simulation loop still uses synthetic metrics
- Evidence:
  - `self_criticize_loop.ts` uses synthetic progression values by design.
- Guardrail:
  - Explicitly marked as `evidenceSource: "LINGUISTIC_ONLY"` and simulation-only summary.
  - Ref: `ts-agent/src/use_cases/self_criticize_loop.ts:79`

## Verification
- Import smoke: passed
- Typecheck: `cd ts-agent && bun run typecheck` passed (`tsc --noEmit`)

