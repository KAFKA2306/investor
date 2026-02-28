# Investment Research Memorandum: Infrastructure Resilience & Alpha Scalability

**Date**: 2026-02-28  
**Subject**: Generation 3/4 Architecture Audit & Risk Mitigation Strategy  
**Classification**: Institutional/Internal  

---

## 0. Executive Summary: Strategic Verdict
The current infrastructure exhibits high research velocity but lacks the **Execution Isolation** required for institutional-scale deployment. To ensure capital survival and alpha persistence, we mandate a phased transition to a **Hexagonal Event-Sourced Architecture**.

**Key Directive**: Decouple the "Alpha Factory" (Research) from the "Execution Engine" (Capital Deployment) while maintaining a Unified Quantum Task Ledger (UQTL) for absolute transparency.

## 1. Diagnostic Evidence: Infrastructure Fragility
Analysis of the current codebase reveals critical bottlenecks that threaten **Execution Fidelity**:

### A. Dependency Circularity (Research Leakage)
- **Observation**: Core orchestration logic is currently dependent on non-validated experiment scenarios (`ts-agent/src/use_cases/run_vegetable_proof.ts`).
- **Risk**: Unverified research code can introduce non-deterministic behavior into the production execution flow.

### B. Schema Contract Mismatch (Data Contamination)
- **Observation**: Discrepancy between `UnifiedRunLogSchema` and the actual emitted `.v1` payloads.
- **Risk**: Potential runtime failure in Risk Attribution reporting and Dashboard calibration.

### C. Execution Environment Hardcoding
- **Observation**: Direct path dependencies (e.g., `"/root/.local/bin/uv"`, `"/mnt/d/marketdata"`) are scattered across gateways.
- **Risk**: Failure of "Immutable Evidence" validation in non-local environments (CI/CD, Cloud Staging).

## 2. Strategic Roadmap: Toward "Infinity: Sovereign Alpha"

### Phase I: Anti-Corruption Framework (Day 0-30)
- **Objective**: Establish **Strict Contract Boundaries**.
- **Action**: Introduce `contracts/` layer for all DTOs (DailyScenarioResult, ExecutionPlan). Decouple `experiments` from the primary execution thread.

### Phase II: Hexagonal Isolation (Day 31-60)
- **Objective**: Achieving **Domain Purity**.
- **Action**: Full separation of Domain Logic from External I/O (Gateways, Python Inference). Normalize all exceptions into `Result<T, AppError>` to prevent unhandled process exits.

### Phase III: Global Pipeline Productization (Day 61-90)
- **Objective**: **Deterministic Reproducibility**.
- **Action**: Implement a declarative workflow engine. Transition to a Plugin-based Signal Registry to ensure new alphas have zero side-effects on existing production flows.

### Phase IV: Infinity (Sovereign Alpha & Self-Evolution)
- **Objective**: Reaching the **Sovereign Alpha State**.
- **Action**:
  - **Event-Sourced UQTL**: Implementing the ledger as a true Event Store (Single Source of Truth).
  - **High-Performance Data Fabric**: Universal adoption of Apache Arrow for zero-copy data transfer between TypeScript and Python/Rust.
  - **Formal Verification Loop**: Automated LLM-driven mathematical proof for all alpha factor logic to eliminate logic-driven drawdowns.

---

## 3. Mandatory Implementation Sequence
1. [x] **Contract Unification**: Global naming standard for `UnifiedRun`.
2. [x] **Path Absolution**: Removal of all system-specific hardcoded paths from Gateways.
3. [x] **Execution Decoupling**: Isolate `paper_executor` from unvalidated experiment types.
4. [ ] **Artifact Isolation**: Relocate `foundation_models/.venv` out of the source tree to optimize CI fidelity.

## 4. Conclusion: Commitment to Excellence
This memorandum is not a call for refactoring for the sake of "clean code", but a **Strategic Imperative** to ensure the survivability and scalability of our Alpha Factory. By hardening our infrastructure foundation, we secure our path to persistent, market-beating returns.

