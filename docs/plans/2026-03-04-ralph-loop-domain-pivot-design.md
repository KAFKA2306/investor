# Ralph Loop Domain Pivot Agent - Design Document

**Goal**: Implement an adaptive domain pivot mechanism in the Ralph Loop to enable autonomous recovery from consecutive discovery failures by intelligently selecting new market domains based on current market regimes.

**Architecture**: The Ralph Loop monitors consecutive audit failures (≥2). When triggered, the `MissionAgent` evaluates market context (volatility, momentum), identifies "Forbidden Zones" (recently failed domains), and selects a domain furthest from those zones. The fitness threshold is temporarily relaxed (0.5 → 0.4) for 3 cycles in the new domain to enable bootstrapping.

**Mapping to Audit Guidelines**: Every "PIVOT" or "REJECT" decision triggered by the Ralph Loop must be categorized according to the standard [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md) (e.g., Orthogonality & Novelty or Metric Thresholds).

---

## 🏗️ Section 1: Overall Architecture

**Ralph Loop Domain Pivot Flow:**

```
[Factor Mining Loop]
  ↓
[consecutiveFailures ≥ 2?]
  ├─ NO → Continue current cycle
  └─ YES → Invoke pivotDomain()
             ↓
        [Retrieve Market Context (volatility, momentum)]
             ↓
        [Execute Adaptive Domain Selection]
             ├─ Identify Forbidden Zones: Recently failed domains (N cycles)
             ├─ Determine Market Regime: High/Low Volatility
             └─ Select Furthest Domain: Domain with maximum distance from Forbidden Zones
             ↓
        [Temporarily Relax Fitness Threshold (0.5 → 0.4)]
             ↓
        [Reset consecutiveFailures & Start New Cycle]
```

**Core Components:**
- `MissionAgent.pivotDomain()`: Logic for determining the next optimal market domain.
- `DomainRegistry`: Registry for available market domains (sectors, timeframes, factor types).
- `ForbiddenZoneTracker`: Manages the history of failed domains with TTL-based decay.
- `MarketContextEvaluator`: Dynamic assessment of current market regimes.
- `pipeline_orchestrator`: Trigger for resets and threshold adjustments.

---

## 💻 Section 2: Component Specifications

### 1) MissionAgent.pivotDomain()
**Responsibility**:
- Retrieve Forbidden Zones from the tracker.
- Evaluate the current market context.
- Select the domain furthest from forbidden regions using Euclidean or Cosine distance.
- Log the pivot rationale using categories from [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md).

### 2) ForbiddenZoneTracker
**Responsibility**:
- Track domains that failed the audit in the last K cycles (K=3).
- Implement TTL for automatic "forgetting" of old failures.
- Calculate distances between domain vectors.

### 3) MarketContextEvaluator
**Responsibility**:
- Calculate real-time volatility and momentum.
- Classify market regimes (High/Mid/Low volatility).
- Align domain suggestions with the current regime.

---

## 🔄 Section 3: Data Flow & State Management

**End-to-End Data Flow:**

```
[Cycle N: Factor Mining Execution]
  ├─ Audit → verdict = PIVOT (fitness < 0.4 or constraint failure)
  ├─ map failure to [REASON_DESC.md] category
  └─ consecutiveFailures++ (N-th failure)
       ↓
[consecutiveFailures === 2?]
  └─ YES
       ├─ Evaluate Market Volatility (trailing 30 days)
       ├─ Identify Forbidden Zones (recent failures)
       ├─ Execute MissionAgent.pivotDomain()
       │   └─ select optimal domain adapted to volatility
       ├─ Set fitnessThreshold = 0.4 (Temporary relaxation)
       └─ Reset consecutiveFailures
```

---

## 🛡️ Section 4: Testing Strategy

| Test Type | Target | Verification Items |
|--------|------|--------|
| **Unit** | `ForbiddenZoneTracker` | TTL decay accuracy, distance calculation correctness. |
| **Unit** | `MissionAgent.pivotDomain()` | Successful avoidance of Forbidden Zones. |
| **Integration** | `pipeline_orchestrator` | Threshold relaxation and failure counter resets. |
| **E2E** | Multi-cycle Loop | Automated domain recovery after 2+ failures. |

---

## 📌 Traceability
All PIVOT outcomes from this mechanism are traceable to [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md). Specifically:
- **Novelty/Orthogonality**: If the failure was due to domain overlap.
- **Metric Thresholds**: If the domain consistently fails performance gates.
- **Hypothesis Validity**: If the market regime renders the domain's economic rationale invalid.
