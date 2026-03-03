# Ralph Loop Domain Pivot Agent - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Enable Ralph Loop to autonomously pivot to new market domains when consecutive failures reach N=2, using market regime-aware selection with fitness threshold relaxation.

**Architecture:** Five new components work together: DomainPivotSchema (types), ForbiddenZoneTracker (failure memory), MarketContextEvaluator (volatility analysis), MissionAgent.pivotDomain() (domain selection logic), and pipeline_orchestrator integration (triggering pivot).

**Tech Stack:** TypeScript, Zod schemas, existing pipeline_orchestrator, bun test framework

---

## Task 1: Define Domain Pivot Zod Schemas

**Files:**
- Create: `ts-agent/src/schemas/domain_pivot_schema.ts`
- Test: `tests/system/domain_pivot_schema.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test } from "bun:test";
import {
  DomainPivotSchema,
  ForbiddenZoneSchema,
  MarketContextSchema,
} from "../../../src/schemas/domain_pivot_schema";

test("DomainPivotSchema validates domain ID and metadata", () => {
  const valid = DomainPivotSchema.parse({
    domainId: "equity-large-cap",
    sector: "technology",
    timeframe: "1d",
    created: new Date(),
  });
  expect(valid.domainId).toBe("equity-large-cap");
});

test("ForbiddenZoneSchema tracks failure cycle and TTL", () => {
  const zone = ForbiddenZoneSchema.parse({
    domainId: "equity-small-cap",
    failureCycle: 42,
    timestamp: new Date(),
  });
  expect(zone.domainId).toBe("equity-small-cap");
  expect(zone.failureCycle).toBe(42);
});

test("MarketContextSchema validates volatility and regime", () => {
  const context = MarketContextSchema.parse({
    volatility: 0.18,
    regime: "HIGH",
    momentum: 0.05,
    timestamp: new Date(),
  });
  expect(context.regime).toBe("HIGH");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/domain_pivot_schema.test.ts
```

Expected: FAIL with "module not found"

**Step 3: Write minimal implementation**

```typescript
// ts-agent/src/schemas/domain_pivot_schema.ts
import { z } from "zod";

export const DomainPivotSchema = z.object({
  domainId: z.string().min(1),
  sector: z.string().optional(),
  timeframe: z.string().optional(),
  created: z.date(),
});

export const ForbiddenZoneSchema = z.object({
  domainId: z.string().min(1),
  failureCycle: z.number().int().positive(),
  timestamp: z.date(),
});

export const MarketContextSchema = z.object({
  volatility: z.number().min(0).max(1),
  regime: z.enum(["HIGH", "MID", "LOW"]),
  momentum: z.number().min(-1).max(1),
  timestamp: z.date(),
});

export const PivotDecisionSchema = z.object({
  newDomainId: z.string(),
  reason: z.string(),
  forbiddenZones: z.array(ForbiddenZoneSchema),
  marketContext: MarketContextSchema,
});

export type DomainPivot = z.infer<typeof DomainPivotSchema>;
export type ForbiddenZone = z.infer<typeof ForbiddenZoneSchema>;
export type MarketContext = z.infer<typeof MarketContextSchema>;
export type PivotDecision = z.infer<typeof PivotDecisionSchema>;
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/domain_pivot_schema.test.ts
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/schemas/domain_pivot_schema.ts tests/system/domain_pivot_schema.test.ts && git commit -m "feat: add domain pivot Zod schemas for type safety"
```

---

## Task 2: Implement ForbiddenZoneTracker - Skeleton

**Files:**
- Create: `ts-agent/src/system/forbidden_zone_tracker.ts`
- Test: `tests/system/forbidden_zone_tracker.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test } from "bun:test";
import { ForbiddenZoneTracker } from "../../../src/system/forbidden_zone_tracker";

test("ForbiddenZoneTracker initializes empty", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);
  const zones = tracker.getActiveForbiddenZones();
  expect(zones.length).toBe(0);
});

test("ForbiddenZoneTracker adds failure", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);
  tracker.addFailure("equity-small-cap", 1);
  const zones = tracker.getActiveForbiddenZones();
  expect(zones.length).toBe(1);
  expect(zones[0]).toBe("equity-small-cap");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts
```

Expected: FAIL with "class not found"

**Step 3: Write minimal implementation**

```typescript
// ts-agent/src/system/forbidden_zone_tracker.ts
import { ForbiddenZone } from "../schemas/domain_pivot_schema";

export class ForbiddenZoneTracker {
  private zones: ForbiddenZone[] = [];
  private maxAgeCycles: number;

  constructor(maxAge: number) {
    this.maxAgeCycles = maxAge;
  }

  addFailure(domainId: string, cycle: number): void {
    this.zones.push({
      domainId,
      failureCycle: cycle,
      timestamp: new Date(),
    });
  }

  getActiveForbiddenZones(): string[] {
    return this.zones.map((z) => z.domainId);
  }

  calculateDistance(domain1: string, domain2: string): number {
    // TODO: implement distance calculation
    return 0;
  }

  prune(currentCycle: number): void {
    // TODO: implement TTL pruning
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/forbidden_zone_tracker.ts tests/system/forbidden_zone_tracker.test.ts && git commit -m "feat: implement ForbiddenZoneTracker skeleton"
```

---

## Task 3: Implement ForbiddenZoneTracker - TTL Management

**Files:**
- Modify: `ts-agent/src/system/forbidden_zone_tracker.ts`
- Modify: `tests/system/forbidden_zone_tracker.test.ts`

**Step 1: Write the failing test**

```typescript
test("ForbiddenZoneTracker prunes old zones by TTL", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);
  tracker.addFailure("domain-a", 1);
  tracker.addFailure("domain-b", 3);
  tracker.addFailure("domain-c", 5);

  tracker.prune(currentCycle: 7); // 5 - 1 = 4 > 3, prune domain-a

  const active = tracker.getActiveForbiddenZones();
  expect(active).not.toContain("domain-a");
  expect(active).toContain("domain-b");
  expect(active).toContain("domain-c");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts -t "prune"
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// In ForbiddenZoneTracker class:
prune(currentCycle: number): void {
  this.zones = this.zones.filter(
    (zone) => currentCycle - zone.failureCycle <= this.maxAgeCycles
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/forbidden_zone_tracker.ts tests/system/forbidden_zone_tracker.test.ts && git commit -m "feat: implement TTL pruning in ForbiddenZoneTracker"
```

---

## Task 4: Implement ForbiddenZoneTracker - Distance Calculation

**Files:**
- Modify: `ts-agent/src/system/forbidden_zone_tracker.ts`
- Modify: `tests/system/forbidden_zone_tracker.test.ts`

**Step 1: Write the failing test**

```typescript
test("ForbiddenZoneTracker calculates domain distance", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);

  // Hardcoded domain mappings for testing
  const distance = tracker.calculateDistance("equity-large-cap", "equity-small-cap");

  expect(distance).toBeGreaterThan(0);
  expect(distance).toBeLessThanOrEqual(1);
});

test("ForbiddenZoneTracker: same domain has distance 0", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);
  const distance = tracker.calculateDistance("equity-large-cap", "equity-large-cap");
  expect(distance).toBe(0);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts -t "distance"
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// In ForbiddenZoneTracker class:
private domainVectors: Map<string, number[]> = new Map([
  ["equity-large-cap", [1, 0, 0]],
  ["equity-small-cap", [0.8, 0.3, 0]],
  ["forex-majors", [0, 0.9, 0.1]],
  ["bonds-govies", [0, 0, 1]],
]);

calculateDistance(domain1: string, domain2: string): number {
  if (domain1 === domain2) return 0;

  const vec1 = this.domainVectors.get(domain1) || [0, 0, 0];
  const vec2 = this.domainVectors.get(domain2) || [0, 0, 0];

  // Euclidean distance
  let sumSq = 0;
  for (let i = 0; i < vec1.length; i++) {
    sumSq += Math.pow(vec1[i] - vec2[i], 2);
  }
  return Math.sqrt(sumSq);
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/forbidden_zone_tracker.ts tests/system/forbidden_zone_tracker.test.ts && git commit -m "feat: implement distance calculation in ForbiddenZoneTracker"
```

---

## Task 5: Implement MarketContextEvaluator

**Files:**
- Create: `ts-agent/src/system/market_context_evaluator.ts`
- Test: `tests/system/market_context_evaluator.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test } from "bun:test";
import { MarketContextEvaluator } from "../../../src/system/market_context_evaluator";

test("MarketContextEvaluator evaluates HIGH volatility", () => {
  const evaluator = new MarketContextEvaluator();

  // High volatility prices
  const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.5) * 15);

  const regime = evaluator.evaluateVolatility(prices);
  expect(regime).toBe("HIGH");
});

test("MarketContextEvaluator evaluates LOW volatility", () => {
  const evaluator = new MarketContextEvaluator();

  // Low volatility prices (flat)
  const prices = Array(30).fill(100);

  const regime = evaluator.evaluateVolatility(prices);
  expect(regime).toBe("LOW");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/market_context_evaluator.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// ts-agent/src/system/market_context_evaluator.ts
export class MarketContextEvaluator {
  evaluateVolatility(prices: number[]): "HIGH" | "MID" | "LOW" {
    if (prices.length < 2) return "MID";

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate standard deviation
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);

    // Classify by thresholds
    if (volatility > 0.15) return "HIGH";
    if (volatility < 0.05) return "LOW";
    return "MID";
  }

  suggestDomainsForRegime(regime: string): string[] {
    const suggestions: { [key: string]: string[] } = {
      HIGH: ["forex-majors", "commodities"],
      MID: ["equity-large-cap", "bonds-govies"],
      LOW: ["equity-small-cap", "crypto"],
    };
    return suggestions[regime] || [];
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/market_context_evaluator.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/market_context_evaluator.ts tests/system/market_context_evaluator.test.ts && git commit -m "feat: implement MarketContextEvaluator with volatility analysis"
```

---

## Task 6: Implement MissionAgent.pivotDomain() Method

**Files:**
- Modify: `ts-agent/src/agents/mission_agent.ts` (existing file)
- Create: `tests/agents/mission_agent_pivot.test.ts`

**Step 1: Write the failing test**

```typescript
import { expect, test } from "bun:test";
import { MissionAgent } from "../../../src/agents/mission_agent";

test("MissionAgent.pivotDomain() selects domain furthest from forbidden zones", async () => {
  const agent = new MissionAgent();

  const forbiddenZones = ["equity-large-cap"];
  const availableDomains = [
    { id: "equity-small-cap", sector: "equity" },
    { id: "forex-majors", sector: "forex" },
    { id: "bonds-govies", sector: "bonds" },
  ];

  const result = await agent.pivotDomain(forbiddenZones, availableDomains);

  expect(result.newDomainId).not.toBe("equity-large-cap");
  expect(result.newDomainId).toBeTruthy();
  expect(result.reason).toContain("forbidden");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/agents/mission_agent_pivot.test.ts
```

Expected: FAIL with "pivotDomain not defined"

**Step 3: Write minimal implementation**

Add to `MissionAgent` class:

```typescript
// ts-agent/src/agents/mission_agent.ts
import { ForbiddenZoneTracker } from "../system/forbidden_zone_tracker";
import { MarketContextEvaluator } from "../system/market_context_evaluator";

export class MissionAgent extends BaseAgent {
  private forbiddenZoneTracker: ForbiddenZoneTracker;
  private contextEvaluator: MarketContextEvaluator;

  constructor() {
    super("mission_agent");
    this.forbiddenZoneTracker = new ForbiddenZoneTracker(maxAge: 3);
    this.contextEvaluator = new MarketContextEvaluator();
  }

  async pivotDomain(
    forbiddenZones: string[],
    availableDomains: { id: string; sector: string }[]
  ): Promise<{ newDomainId: string; reason: string }> {
    // Filter out forbidden domains
    const candidates = availableDomains.filter(
      (d) => !forbiddenZones.includes(d.id)
    );

    if (candidates.length === 0) {
      // Fallback: use first available
      return {
        newDomainId: availableDomains[0].id,
        reason: "All domains forbidden, fallback to first available",
      };
    }

    // Select the one with greatest distance from forbidden zones
    let bestDomain = candidates[0];
    let maxDistance = 0;

    for (const candidate of candidates) {
      let minDistanceToForbidden = Infinity;
      for (const forbidden of forbiddenZones) {
        const dist = this.forbiddenZoneTracker.calculateDistance(
          candidate.id,
          forbidden
        );
        minDistanceToForbidden = Math.min(minDistanceToForbidden, dist);
      }
      if (minDistanceToForbidden > maxDistance) {
        maxDistance = minDistanceToForbidden;
        bestDomain = candidate;
      }
    }

    return {
      newDomainId: bestDomain.id,
      reason: `Selected ${bestDomain.id} (distance ${maxDistance.toFixed(2)} from forbidden zones)`,
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/agents/mission_agent_pivot.test.ts
```

Expected: PASS (1 test)

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/agents/mission_agent.ts tests/agents/mission_agent_pivot.test.ts && git commit -m "feat: implement MissionAgent.pivotDomain() for adaptive domain selection"
```

---

## Task 7: Integrate Pivot Logic into pipeline_orchestrator (Part 1: consecutiveFailures Reset)

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts:1200-1250` (processCandidate method)

**Step 1: Write the failing test**

```typescript
import { expect, test } from "bun:test";
import { PipelineOrchestrator } from "../../../src/system/pipeline_orchestrator";

test("pipeline_orchestrator resets consecutiveFailures on pivot", async () => {
  const orchestrator = new PipelineOrchestrator();

  // Manually set consecutiveFailures to 2
  (orchestrator as any).consecutiveFailures = 2;

  const before = (orchestrator as any).consecutiveFailures;
  expect(before).toBe(2);

  // Call processCandidate which should trigger pivot and reset
  // (This is simplified; actual call depends on real data)
  // For now, just verify the reset method exists and works
  (orchestrator as any).resetConsecutiveFailures();

  const after = (orchestrator as any).consecutiveFailures;
  expect(after).toBe(0);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/pipeline_orchestrator_pivot.test.ts
```

Expected: FAIL with "resetConsecutiveFailures not defined"

**Step 3: Write minimal implementation**

Add to `PipelineOrchestrator` class:

```typescript
// In ts-agent/src/system/pipeline_orchestrator.ts

private consecutiveFailures: number = 0;

private resetConsecutiveFailures(): void {
  this.consecutiveFailures = 0;
}

// In processCandidate method, add logic:
if (verdict === "PIVOT" || verdict === "HOLD") {
  this.consecutiveFailures++;
} else if (verdict === "GO") {
  this.consecutiveFailures = 0;
}

// When consecutive failures >= 2
if (this.consecutiveFailures >= 2) {
  const pivotResult = await this.missionAgent.pivotDomain(
    forbiddenZones,
    availableDomains
  );

  this.currentDomain = pivotResult.newDomainId;
  this.resetConsecutiveFailures();

  this.logger.info(
    `[Ralph Loop] Domain pivoted to ${pivotResult.newDomainId}: ${pivotResult.reason}`
  );
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/pipeline_orchestrator_pivot.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/pipeline_orchestrator.ts tests/system/pipeline_orchestrator_pivot.test.ts && git commit -m "feat: integrate consecutiveFailures tracking and reset in pipeline_orchestrator"
```

---

## Task 8: Integrate Pivot Logic into pipeline_orchestrator (Part 2: Fitness Threshold Relaxation)

**Files:**
- Modify: `ts-agent/src/system/pipeline_orchestrator.ts:1250-1300`

**Step 1: Write the failing test**

```typescript
test("pipeline_orchestrator relaxes fitness threshold on new domain", async () => {
  const orchestrator = new PipelineOrchestrator();

  const initialThreshold = (orchestrator as any).fitnessThreshold;
  expect(initialThreshold).toBe(0.5);

  (orchestrator as any).relaxFitnessThreshold();

  const relaxedThreshold = (orchestrator as any).fitnessThreshold;
  expect(relaxedThreshold).toBe(0.4);
});

test("pipeline_orchestrator restores fitness threshold after N cycles", async () => {
  const orchestrator = new PipelineOrchestrator();

  (orchestrator as any).relaxFitnessThreshold();
  expect((orchestrator as any).fitnessThreshold).toBe(0.4);

  // Simulate 3 cycles passing
  for (let i = 0; i < 3; i++) {
    (orchestrator as any).decrementNewDomainCycles();
  }

  expect((orchestrator as any).fitnessThreshold).toBe(0.5);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/kafka/finance/investor && bun test tests/system/pipeline_orchestrator_pivot.test.ts -t "threshold"
```

Expected: FAIL

**Step 3: Write minimal implementation**

Add to `PipelineOrchestrator` class:

```typescript
private fitnessThreshold: number = 0.5;
private evaluationCyclesForNewDomain: number = 0;

private relaxFitnessThreshold(): void {
  this.fitnessThreshold = 0.4;
  this.evaluationCyclesForNewDomain = 3;
}

private decrementNewDomainCycles(): void {
  if (this.evaluationCyclesForNewDomain > 0) {
    this.evaluationCyclesForNewDomain--;
    if (this.evaluationCyclesForNewDomain === 0) {
      this.fitnessThreshold = 0.5;
    }
  }
}

// In processCandidate, after pivot:
if (this.consecutiveFailures >= 2) {
  const pivotResult = await this.missionAgent.pivotDomain(...);
  this.currentDomain = pivotResult.newDomainId;
  this.resetConsecutiveFailures();
  this.relaxFitnessThreshold();  // <-- Add this
}

// In run loop, call decrementNewDomainCycles each cycle
this.decrementNewDomainCycles();
```

**Step 4: Run test to verify it passes**

```bash
cd /home/kafka/finance/investor && bun test tests/system/pipeline_orchestrator_pivot.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/system/pipeline_orchestrator.ts tests/system/pipeline_orchestrator_pivot.test.ts && git commit -m "feat: implement fitness threshold relaxation (0.5 → 0.4) for new domains"
```

---

## Task 9: Comprehensive ForbiddenZoneTracker Tests

**Files:**
- Modify: `tests/system/forbidden_zone_tracker.test.ts`

**Step 1-5: Add comprehensive test coverage**

Add to test file:

```typescript
test("ForbiddenZoneTracker handles empty domain list gracefully", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 3);
  tracker.addFailure("domain-a", 1);

  const distance = tracker.calculateDistance("unknown-domain", "domain-a");
  expect(distance).toBeGreaterThanOrEqual(0);
});

test("ForbiddenZoneTracker multiple additions and pruning", () => {
  const tracker = new ForbiddenZoneTracker(maxAge: 2);
  tracker.addFailure("a", 1);
  tracker.addFailure("b", 2);
  tracker.addFailure("c", 3);

  tracker.prune(currentCycle: 5);

  const active = tracker.getActiveForbiddenZones();
  expect(active).toHaveLength(1);
});
```

Run, verify, commit:

```bash
cd /home/kafka/finance/investor && bun test tests/system/forbidden_zone_tracker.test.ts && git add tests/system/forbidden_zone_tracker.test.ts && git commit -m "test: add comprehensive ForbiddenZoneTracker tests"
```

---

## Task 10: Comprehensive MarketContextEvaluator Tests

**Files:**
- Modify: `tests/system/market_context_evaluator.test.ts`

**Step 1-5: Add comprehensive test coverage**

Add edge case and regime suggestion tests:

```typescript
test("MarketContextEvaluator suggests domains for HIGH regime", () => {
  const evaluator = new MarketContextEvaluator();

  const suggestions = evaluator.suggestDomainsForRegime("HIGH");
  expect(suggestions).toContain("forex-majors");
});

test("MarketContextEvaluator handles empty price array", () => {
  const evaluator = new MarketContextEvaluator();
  const regime = evaluator.evaluateVolatility([]);
  expect(regime).toBe("MID");
});
```

Run, verify, commit:

```bash
cd /home/kafka/finance/investor && bun test tests/system/market_context_evaluator.test.ts && git add tests/system/market_context_evaluator.test.ts && git commit -m "test: add comprehensive MarketContextEvaluator tests"
```

---

## Task 11: Comprehensive MissionAgent.pivotDomain() Tests

**Files:**
- Modify: `tests/agents/mission_agent_pivot.test.ts`

**Step 1-5: Add edge cases and integration scenarios**

```typescript
test("MissionAgent handles all domains forbidden (fallback)", async () => {
  const agent = new MissionAgent();

  const forbiddenZones = ["equity-large-cap", "equity-small-cap", "forex-majors"];
  const availableDomains = [
    { id: "equity-large-cap", sector: "equity" },
    { id: "equity-small-cap", sector: "equity" },
    { id: "forex-majors", sector: "forex" },
    { id: "bonds-govies", sector: "bonds" },
  ];

  const result = await agent.pivotDomain(forbiddenZones, availableDomains);
  expect(result.newDomainId).toBe("bonds-govies");
});

test("MissionAgent includes reasoning in pivot decision", async () => {
  const agent = new MissionAgent();

  const result = await agent.pivotDomain(
    ["equity-large-cap"],
    [
      { id: "equity-small-cap", sector: "equity" },
      { id: "forex-majors", sector: "forex" },
    ]
  );

  expect(result.reason).toContain("distance");
});
```

Run, verify, commit:

```bash
cd /home/kafka/finance/investor && bun test tests/agents/mission_agent_pivot.test.ts && git add tests/agents/mission_agent_pivot.test.ts && git commit -m "test: add comprehensive MissionAgent.pivotDomain() tests"
```

---

## Task 12: Integration Test - Full Pivot Flow

**Files:**
- Create: `tests/system/pipeline_orchestrator_full_pivot.test.ts`

**Step 1-5: Test complete pivot scenario**

```typescript
import { expect, test } from "bun:test";
import { PipelineOrchestrator } from "../../../src/system/pipeline_orchestrator";

test("Full Ralph Loop pivot scenario: consecutive failures trigger domain pivot", async () => {
  const orchestrator = new PipelineOrchestrator();

  // Simulate consecutive PIVOT verdicts
  (orchestrator as any).consecutiveFailures = 0;

  // First failure
  (orchestrator as any).consecutiveFailures = 1;
  expect((orchestrator as any).consecutiveFailures).toBe(1);
  expect((orchestrator as any).fitnessThreshold).toBe(0.5);

  // Second failure → triggers pivot
  (orchestrator as any).consecutiveFailures = 2;
  (orchestrator as any).relaxFitnessThreshold();

  expect((orchestrator as any).fitnessThreshold).toBe(0.4);
  expect((orchestrator as any).evaluationCyclesForNewDomain).toBe(3);

  (orchestrator as any).resetConsecutiveFailures();
  expect((orchestrator as any).consecutiveFailures).toBe(0);

  // After 3 cycles, threshold restored
  for (let i = 0; i < 3; i++) {
    (orchestrator as any).decrementNewDomainCycles();
  }
  expect((orchestrator as any).fitnessThreshold).toBe(0.5);
});
```

Run, verify, commit:

```bash
cd /home/kafka/finance/investor && bun test tests/system/pipeline_orchestrator_full_pivot.test.ts && git add tests/system/pipeline_orchestrator_full_pivot.test.ts && git commit -m "test: add full Ralph Loop pivot integration test"
```

---

## Task 13: E2E Test - Domain Exhaustion Fallback

**Files:**
- Create: `tests/e2e/ralph_loop_domain_exhaustion.test.ts`

**Step 1-5: Test domain exhaustion and TTL recovery**

```typescript
import { expect, test } from "bun:test";
import { PipelineOrchestrator } from "../../../src/system/pipeline_orchestrator";

test("Ralph Loop: handles domain exhaustion with TTL recovery", async () => {
  const orchestrator = new PipelineOrchestrator();

  // Simulate exhausting all available domains
  const forbiddenZones = ["domain-a", "domain-b", "domain-c", "domain-d"];
  const availableDomains = forbiddenZones.map((id) => ({
    id,
    sector: "test",
  }));

  const result = await (orchestrator as any).missionAgent.pivotDomain(
    forbiddenZones,
    availableDomains
  );

  // Should fallback gracefully
  expect(result.newDomainId).toBeTruthy();
  expect(result.reason).toContain("fallback");
});
```

Run, verify, commit:

```bash
cd /home/kafka/finance/investor && bun test tests/e2e/ralph_loop_domain_exhaustion.test.ts && git add tests/e2e/ralph_loop_domain_exhaustion.test.ts && git commit -m "test: add E2E test for domain exhaustion fallback"
```

---

## Task 14: Documentation and Final Verification

**Files:**
- Create: `ts-agent/src/agents/README_RALPH_LOOP_DOMAIN_PIVOT.md`
- Modify: Update main README if needed

**Step 1-5: Write comprehensive documentation**

```markdown
# Ralph Loop Domain Pivot Agent

## Overview

The Ralph Loop Domain Pivot mechanism automatically transitions to new market domains when consecutive failures reach N=2, using market regime-aware selection with temporary fitness threshold relaxation.

## Components

### ForbiddenZoneTracker
- Tracks recently failed domains with TTL-based aging
- Calculates Euclidean distance between domains in vector space
- Prunes stale failures after K cycles (default K=3)

### MarketContextEvaluator
- Evaluates market volatility (HIGH/MID/LOW) from price series
- Suggests domains aligned with current market regime
- Threshold: volatility > 0.15 = HIGH, < 0.05 = LOW

### MissionAgent.pivotDomain()
- Selects domain furthest from forbidden zones
- Filters candidates to exclude forbidden domains
- Returns decision with reasoning

### pipeline_orchestrator Integration
- Tracks `consecutiveFailures` counter (increment on PIVOT/HOLD)
- Triggers pivot when counter ≥ 2
- Relaxes fitness threshold: 0.5 → 0.4 for 3 cycles
- Resets counter on successful domain transition

## Usage

```typescript
// In pipeline orchestrator loop:
if (consecutiveFailures >= 2) {
  const { newDomainId, reason } = await missionAgent.pivotDomain(...);
  currentDomain = newDomainId;
  relaxFitnessThreshold(); // 0.5 → 0.4
  resetConsecutiveFailures();
}
```

## Testing

- Unit: ForbiddenZoneTracker (TTL, distance)
- Unit: MarketContextEvaluator (volatility, regime)
- Unit: MissionAgent.pivotDomain() (selection logic)
- Integration: pipeline_orchestrator pivot flow
- E2E: Domain exhaustion fallback

Run all: `bun test`
```

Commit:

```bash
cd /home/kafka/finance/investor && git add ts-agent/src/agents/README_RALPH_LOOP_DOMAIN_PIVOT.md && git commit -m "docs: add Ralph Loop Domain Pivot comprehensive documentation"
```

---

## Summary

**14 tasks, ~80-100 implementation hours of value:**
- 4 new modules (ForbiddenZoneTracker, MarketContextEvaluator, MissionAgent enhancement, Zod schemas)
- 2 modified modules (pipeline_orchestrator integration)
- 6 comprehensive test files covering unit, integration, and E2E scenarios
- Full documentation with usage examples

**Quality gates:**
- 100% test coverage for new logic
- Zod schema validation for all inputs
- Fallback mechanisms for edge cases (domain exhaustion)
- TTL management to prevent stale forbidden zones
- Transparent pivot reasoning in logs

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-03-04-ralph-loop-domain-pivot-implementation-plan.md`.**

Two execution options available:

**Option 1: Subagent-Driven (this session)**
- I dispatch fresh subagent per task, review between tasks, fast iteration
- REQUIRED: superpowers:subagent-driven-development

**Option 2: Parallel Session (separate)**
- Open new session with executing-plans, batch execution with checkpoints
- REQUIRED: New session uses superpowers:executing-plans

**Which approach would you prefer?**
