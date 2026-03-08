# Ralph Loop Domain Pivot Agent - Implementation Plan

**Goal**: Enable the **Ralph Loop** to autonomously pivot to new market domains when consecutive failures reach **N=2**, using market regime-aware selection and temporary fitness threshold relaxation.

**Architecture**:
- **DomainPivotSchema**: Type-safe structures for domains and market context.
- **ForbiddenZoneTracker**: Memory of recently failed domains with TTL-based pruning.
- **MarketContextEvaluator**: Real-time volatility and regime classification.
- **MissionAgent.pivotDomain()**: Core logic for selected the furthest domain from failures.
- **Orchestrator Integration**: Triggering resets and threshold relaxation (0.5 → 0.4).

**Mapping to Audit Guidelines**: All PIVOT decisions must be supported by evidence mapped to categories in [REASON_DESC.md](file:///home/kafka/finance/investor/.agent/workflows/REASON_DESC.md).

---

## Task 1: Foundation (Schemas & Tracker)

### 1.1 Zod Schemas
Create `ts-agent/src/schemas/domain_pivot_schema.ts` with schemas for `DomainPivot`, `ForbiddenZone`, and `MarketContext`.

### 1.2 Forbidden Zone Tracker
Implement `ts-agent/src/system/forbidden_zone_tracker.ts`.
- **Logic**: Track failures by cycle, implement TTL pruning, and calculate Euclidean distance between domain vectors.

---

## Task 2: Market Context & Pivot Logic

### 2.1 Market Context Evaluator
Implement `ts-agent/src/system/market_context_evaluator.ts`.
- **Logic**: Calculate volatility from price data and classify into HIGH/MID/LOW regimes.

### 2.2 MissionAgent.pivotDomain()
Implement the `pivotDomain` method in `ts-agent/src/agents/mission_agent.ts`.
- **Logic**: Select candidate domains that match the current regime and are geographically distant (in factor space) from forbidden zones.

---

## Task 3: Pipeline Integration

### 3.1 Orchestrator Trigger
Modify `ts-agent/src/system/pipeline_orchestrator.ts`.
- **Logic**: 
  - Track `consecutiveFailures`.
  - When failures == 2, trigger `missionAgent.pivotDomain`.
  - Relax `fitnessThreshold` from 0.5 to 0.4 for the first 3 cycles of the new domain.

---

## Verification Plan

### Automated Tests
- `tests/system/forbidden_zone_tracker.test.ts`: Verify TTL and distance logic.
- `tests/agents/mission_agent_pivot.test.ts`: Verify optimal domain selection.
- `tests/system/pipeline_orchestrator_pivot.test.ts`: Verify threshold relaxation and failure resets.

### Manual Verification
- Execute `task run:newalphasearch:loop` and simulate failures to observe the automated domain pivot in the logs.
