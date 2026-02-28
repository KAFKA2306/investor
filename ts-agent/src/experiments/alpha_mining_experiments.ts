import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";
import { readFileSync } from "node:fs";
import {
  FactorComputeEngine,
  type FactorAST,
} from "../pipeline/factor_mining/factor_compute_engine.ts";
import { writeCanonicalEnvelope } from "../system/app_runtime_core.ts";
import { DataPipelineRuntime } from "../system/data_pipeline_runtime.ts";
import { paths } from "../system/path_registry.ts";

const Universe = new DataPipelineRuntime().resolveUniverse([], 120);
const DISCOVERY_SELECTION_THRESHOLD = 0.62;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const tokenize = (text: string): Set<string> =>
  new Set((text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(Boolean));

const jaccardSimilarity = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 && right.size === 0) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  if (union === 0) return 0;
  return intersection / union;
};

const buildNoveltyScoreMap = (
  hypotheses: Awaited<ReturnType<LesAgent["generateHypotheses"]>>,
): Map<string, number> => {
  const tokensById = new Map<string, Set<string>>();
  for (const h of hypotheses) {
    const signature = `${h.description} ${h.reasoning} ${JSON.stringify(h.ast)}`;
    tokensById.set(h.id, tokenize(signature));
  }

  const noveltyById = new Map<string, number>();
  for (const h of hypotheses) {
    const source = tokensById.get(h.id) ?? new Set<string>();
    let maxSimilarity = 0;
    for (const peer of hypotheses) {
      if (peer.id === h.id) continue;
      const target = tokensById.get(peer.id) ?? new Set<string>();
      maxSimilarity = Math.max(
        maxSimilarity,
        jaccardSimilarity(source, target),
      );
    }
    noveltyById.set(h.id, clamp01(1 - maxSimilarity));
  }
  return noveltyById;
};

const astExecutable = (ast: unknown): boolean => {
  if (!ast || typeof ast !== "object") return false;
  const candidate = ast as FactorAST;
  const barA = {
    Date: "2022-01-04",
    Open: 100,
    High: 103,
    Low: 99,
    Close: 102,
    Volume: 2_000_000,
  };
  const barB = {
    Date: "2022-01-05",
    Open: 101,
    High: 106,
    Low: 100,
    Close: 104,
    Volume: 1_500_000,
  };
  const v1 = FactorComputeEngine.evaluate(candidate, barA);
  const v2 = FactorComputeEngine.evaluate(candidate, barB);
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) return false;
  return Math.abs(v1 - v2) > 1e-10 || Math.abs(v1) > 1e-10 || Math.abs(v2) > 1e-10;
};

/**
 * Playbook Curation Logic
 */
export async function curateAlphaPlaybook() {
  const playbook = new ContextPlaybook();
  await playbook.load();
  const verification = JSON.parse(
    readFileSync(paths.verificationJson, "utf8"),
  ) as {
    metrics: { sharpe: number; totalReturn: number };
  };
  const measured = {
    sharpe: verification.metrics.sharpe,
    returnUplift: verification.metrics.totalReturn / 100,
  };
  console.log("📝 Curating successful Alpha Factors into Playbook...");
  playbook.addBullet({
    content:
      "INTRA_RANGE_POS Factor: (Close - Low) / (High - Low). Captures end-of-day buy pressure.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscovery",
      type: "HYPOTHESIS",
      performance: measured,
    },
  });
  playbook.addBullet({
    content:
      "OP_MARGIN Factor: Operating Profit / Net Sales. Serves as a quality-based buffer.",
    section: "strategies_and_hard_rules",
    metadata: {
      source: "AlphaDiscovery",
      type: "HYPOTHESIS",
      performance: measured,
    },
  });
  await playbook.save();
  console.log("✅ Playbook updated.");
}

/**
 * Alpha Factor Discovery Logic
 */
export async function discoverAlphaFactors() {
  const agent = new LesAgent();
  const playbook = new ContextPlaybook();
  const startedAt = new Date().toISOString();
  await playbook.load();
  console.log(`🚀 Starting Discovery over Universe: ${Universe.join(", ")}`);
  const hypotheses = await agent.generateHypotheses(playbook.getBullets());
  console.log(`Generated ${hypotheses.length} hypotheses.`);
  const [plausibilityChecks, riskChecks] = await Promise.all([
    Promise.all(hypotheses.map((h) => agent.evaluateReliability(h))),
    Promise.all(hypotheses.map((h) => agent.evaluateRisk(h))),
  ]);
  const astById = new Map(hypotheses.map((h) => [h.id, h.ast]));
  const noveltyById = buildNoveltyScoreMap(hypotheses);
  const generatedAt = new Date().toISOString();
  const asOfDate = generatedAt.slice(0, 10).replaceAll("-", "");

  const scoredCandidates = hypotheses.map((h, index) => {
    const plausibility = plausibilityChecks[index]!.rs;
    const riskAdjusted = riskChecks[index]!.rs;
    const novelty = noveltyById.get(h.id) ?? 0;
    const priority = clamp01(
      plausibility * 0.5 + riskAdjusted * 0.3 + novelty * 0.2,
    );
    const rejectionFromReasoning =
      plausibilityChecks[index]!.rejectionReason ??
      riskChecks[index]!.rejectionReason;

    return {
      id: h.id,
      description: h.description,
      reasoning: h.reasoning,
      generation: h.generation,
      parentId: h.parentId,
      mutationType: h.mutationType,
      recency: generatedAt,
      rejectionFromReasoning,
      scores: {
        priority,
        plausibility,
        riskAdjusted,
        novelty,
      },
    };
  });
  const sortedCandidates = [...scoredCandidates].sort(
    (left, right) => right.scores.priority - left.scores.priority,
  );
  const thresholdSelections = sortedCandidates
    .filter(
      (candidate) =>
        candidate.scores.priority >= DISCOVERY_SELECTION_THRESHOLD &&
        !candidate.rejectionFromReasoning &&
        astExecutable(astById.get(candidate.id)),
    )
    .map((candidate) => candidate.id);
  const forcedSelection =
    thresholdSelections.length > 0
      ? thresholdSelections
      : sortedCandidates
          .filter((candidate) => astExecutable(astById.get(candidate.id)))
          .slice(0, 1)
          .map((candidate) => candidate.id);
  if (forcedSelection.length === 0) {
    throw new Error("No executable hypothesis AST available for selection");
  }
  const selectedSet = new Set(forcedSelection);
  const candidates = scoredCandidates.map((candidate) => ({
    id: candidate.id,
    description: candidate.description,
    reasoning: candidate.reasoning,
    status: selectedSet.has(candidate.id)
      ? ("SELECTED" as const)
      : ("REJECTED" as const),
    rejectReason: selectedSet.has(candidate.id)
      ? undefined
      : (candidate.rejectionFromReasoning ??
        "Priority score was below top-ranked candidate."),
    recency: candidate.recency,
    scores: candidate.scores,
    generation: candidate.generation,
    parentId: candidate.parentId,
    mutationType: candidate.mutationType,
  }));

  for (const h of candidates) {
    console.log(`\n🧪 Hypothesis: ${h.description}`);
    console.log(`   ID: ${h.id}`);
    console.log(`   Reasoning: ${h.reasoning}`);

    playbook.addBullet({
      content: `${h.description}: ${h.reasoning}`,
      section: "strategies_and_hard_rules",
      metadata: {
        source: "AlphaDiscovery",
        type: "HYPOTHESIS",
        id: h.id,
        ast: astById.get(h.id),
        status: h.status,
        score: h.scores.priority,
        generation: h.generation,
        parentId: h.parentId,
        mutationType: h.mutationType,
      },
    });
  }

  await playbook.save();
  const selected = [...selectedSet];

  writeCanonicalEnvelope({
    kind: "alpha_discovery",
    asOfDate,
    generatedAt,
    producerComponent:
      "experiments.alpha_mining_experiments.discoverAlphaFactors",
    sourceSchema: "investor.alpha-discovery.v3",
    sourceBucket: "unified",
    payload: {
      schema: "investor.alpha-discovery.v3",
      date: asOfDate,
      generatedAt,
      stage: "DISCOVERY_PRECHECK",
      scoreType: "LINGUISTIC_PRECHECK",
      evidence: {
        sampleSize: candidates.length,
        selectedCount: selected.length,
        selectionRate: selected.length / Math.max(1, candidates.length),
      },
      quality: {
        completeness: "COMPLETE",
        missingFields: [],
      },
      selected,
      candidates,
      universe: Universe,
      startedAt,
    },
  });
  console.log("\n✅ Playbook updated with new hypotheses.");
}

if (import.meta.main) {
  if (process.argv.includes("--curate")) {
    curateAlphaPlaybook();
  } else {
    discoverAlphaFactors();
  }
}
