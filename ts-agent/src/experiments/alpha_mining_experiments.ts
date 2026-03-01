import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  LesAgent,
  readNaturalLanguageInput,
} from "../agents/latent_economic_signal_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";
import {
  type FactorAST,
  FactorComputeEngine,
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

const sha256hex = (value: string, length: number): string =>
  createHash("sha256").update(value).digest("hex").slice(0, length);

const collectAstVariables = (node: unknown, bucket: Set<string>): void => {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = String(record.type || "");
  if (type === "variable") {
    const name = String(record.name || "")
      .trim()
      .toLowerCase();
    name && bucket.add(name);
  }
  record.left && collectAstVariables(record.left, bucket);
  record.right && collectAstVariables(record.right, bucket);
};

const buildFeatureSignature = (ast: unknown): string[] => {
  const bucket = new Set<string>();
  collectAstVariables(ast, bucket);
  return [...bucket].sort();
};

const loadSeenIdeaHashes = (): Set<string> => {
  if (!existsSync(paths.unifiedLogDir)) return new Set<string>();
  const files = readdirSync(paths.unifiedLogDir)
    .filter((f) => /^alpha_discovery_\d{8}_\d{14}\.json$/.test(f))
    .sort()
    .slice(-80);
  const seen = new Set<string>();
  for (const file of files) {
    try {
      const raw = readFileSync(`${paths.unifiedLogDir}/${file}`, "utf8");
      const parsed = JSON.parse(raw) as {
        payload?: {
          selectedDetails?: { ideaHash?: string }[];
          candidates?: {
            status?: string;
            ideaHash?: string;
          }[];
        };
      };
      const details = parsed.payload?.selectedDetails ?? [];
      for (const detail of details) {
        const hash = String(detail.ideaHash || "");
        hash && seen.add(hash);
      }
      if (details.length === 0) {
        for (const candidate of parsed.payload?.candidates ?? []) {
          if (candidate.status !== "SELECTED") continue;
          const hash = String(candidate.ideaHash || "");
          hash && seen.add(hash);
        }
      }
    } catch {}
  }
  return seen;
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
    CorrectionCount: 0,
    LargeHolderCount: 0,
    MacroIIP: 100,
    MacroCPI: 102.5,
  };
  const barB = {
    Date: "2022-01-05",
    Open: 101,
    High: 106,
    Low: 100,
    Close: 104,
    Volume: 1_500_000,
    CorrectionCount: 1,
    LargeHolderCount: 0,
    MacroIIP: 101.2,
    MacroCPI: 102.6,
  };
  const bars = [barA, barB];
  const v1 = FactorComputeEngine.evaluate(candidate, bars, 0);
  const v2 = FactorComputeEngine.evaluate(candidate, bars, 1);
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) return false;
  return true;
};

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

export async function discoverAlphaFactors() {
  const agent = new LesAgent();
  const playbook = new ContextPlaybook();
  const startedAt = new Date().toISOString();
  const runId =
    process.env.UQTL_RUN_ID ??
    `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const loopIteration = Number.parseInt(
    process.env.UQTL_LOOP_ITERATION ?? "0",
    10,
  );
  const nlInput = readNaturalLanguageInput();
  const rawNaturalLanguageInput = nlInput.text;
  const inputChannel = (process.env.UQTL_INPUT_CHANNEL || "task").trim();
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

  const seenIdeaHashes = loadSeenIdeaHashes();
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

    const featureSignature = (
      h.featureSignature && h.featureSignature.length > 0
        ? h.featureSignature
        : buildFeatureSignature(h.ast)
    ).slice(0, 12);
    const ideaHash = sha256hex(
      JSON.stringify({
        desc: h.description,
        reasoning: h.reasoning,
        ast: h.ast,
        featureSignature,
      }),
      24,
    );
    const adoptionScore = clamp01(priority * 0.8 + novelty * 0.2);
    const isNovelAgainstHistory = !seenIdeaHashes.has(ideaHash);

    return {
      id: h.id,
      description: h.description,
      reasoning: h.reasoning,
      generation: h.generation,
      parentId: h.parentId,
      mutationType: h.mutationType,
      recency: generatedAt,
      rejectionFromReasoning,
      ideaHash,
      isNovelAgainstHistory,
      featureSignature,
      themeSource: h.themeSource ?? "LOCAL",
      llmModel: h.llmModel ?? "",
      scores: {
        priority,
        plausibility,
        riskAdjusted,
        novelty,
        fitness: clamp01((plausibility + riskAdjusted) / 2),
        stability: clamp01(0.5 + (plausibility - riskAdjusted) * 0.25),
        adoption: adoptionScore,
      },
    };
  });
  const sortedCandidates = [...scoredCandidates].sort(
    (left, right) => right.scores.priority - left.scores.priority,
  );
  const executableById = new Map(
    scoredCandidates.map((c) => [c.id, astExecutable(astById.get(c.id))]),
  );
  const thresholdSelections = sortedCandidates
    .filter(
      (candidate) =>
        candidate.scores.priority >= DISCOVERY_SELECTION_THRESHOLD &&
        candidate.isNovelAgainstHistory &&
        !candidate.rejectionFromReasoning &&
        executableById.get(candidate.id),
    )
    .map((candidate) => candidate.id);
  const forcedSelection =
    thresholdSelections.length > 0
      ? thresholdSelections
      : sortedCandidates
          .filter(
            (candidate) =>
              candidate.isNovelAgainstHistory &&
              executableById.get(candidate.id),
          )
          .slice(0, 1)
          .map((candidate) => candidate.id);
  if (forcedSelection.length === 0) {
    throw new Error(
      "No novel executable hypothesis AST available for selection in this cycle",
    );
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
    ideaHash: candidate.ideaHash,
    isNovelAgainstHistory: candidate.isNovelAgainstHistory,
    featureSignature: candidate.featureSignature,
    themeSource: candidate.themeSource,
    llmModel: candidate.llmModel,
    generation: candidate.generation,
    parentId: candidate.parentId,
    mutationType: candidate.mutationType,
    ast: astById.get(candidate.id),
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
        runId,
        loopIteration: Number.isFinite(loopIteration) ? loopIteration : 0,
        ast: astById.get(h.id),
        status: h.status,
        score: h.scores.priority,
        fitnessScore: h.scores.fitness,
        noveltyScore: h.scores.novelty,
        stabilityScore: h.scores.stability,
        adoptionScore: h.scores.adoption,
        ideaHash: h.ideaHash,
        featureSignature: h.featureSignature,
        themeSource: h.themeSource,
        llmModel: h.llmModel,
        generation: h.generation,
        parentId: h.parentId,
        mutationType: h.mutationType,
      },
    });
  }

  await playbook.save();
  const selected = [...selectedSet];
  const selectedDetails = candidates
    .filter((c) => c.status === "SELECTED")
    .map((c) => ({
      id: c.id,
      ideaHash: c.ideaHash,
      featureSignature: c.featureSignature,
      noveltyScore: c.scores.novelty,
      adoptionScore: c.scores.adoption,
      themeSource: c.themeSource,
      llmModel: c.llmModel,
    }));

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
        selectedNovelCount: selectedDetails.length,
        openAIThemeUsage: candidates.filter((c) => c.themeSource === "OPENAI")
          .length,
      },
      quality: {
        completeness: "COMPLETE",
        missingFields: [],
      },
      selected,
      selectedDetails,
      candidates,
      universe: Universe,
      startedAt,
      input: {
        channel: inputChannel || "task",
        nlInputProvided: rawNaturalLanguageInput.length > 0,
        nlInputHash:
          rawNaturalLanguageInput.length > 0
            ? sha256hex(rawNaturalLanguageInput, 16)
            : "",
        nlInputPreview:
          rawNaturalLanguageInput.length > 0
            ? rawNaturalLanguageInput.slice(0, 140)
            : "",
      },
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
