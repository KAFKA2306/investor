import { CqoAgent } from "../agents/chief_quant_officer_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";
import { BaseAgent } from "./app_runtime_core.ts";
import type {
  IDataEngineer,
  IdeaCandidate,
  IElder,
  IExecutionAgent,
  IQuantResearcher,
  IStateMonitor,
  PITDataset,
  PipelineRequirement,
  VerificationResult,
} from "./pipeline_types.ts";

type VerificationVerdict =
  | "ADOPTED"
  | "REJECTED_DATA"
  | "REJECTED_MODEL"
  | "REJECTED_GENERAL";

export class PipelineOrchestrator extends BaseAgent {
  private cqo = new CqoAgent();

  constructor(
    private readonly elder: IElder,
    private readonly dataEngineer: IDataEngineer,
    private readonly quantResearcher: IQuantResearcher,
    private readonly executionAgent: IExecutionAgent,
    private readonly stateMonitor: IStateMonitor,
  ) {
    super();
  }

  public async runPipeline(requirement: PipelineRequirement): Promise<void> {
    this.emitEvent("PIPELINE_STARTED", { requirementId: requirement.id });

    const history = await this.elder.getHistory(requirement.id);
    const state = await this.stateMonitor.getCurrentState();
    const candidates = await this.generateHighLevelIdeas(
      requirement,
      history,
      state,
    );

    for (const candidate of candidates) {
      await this.elder.saveIdeaCandidate(candidate);

      const phaseOne = await this.acquireAcceptedDataset(
        requirement,
        candidate.id,
        1,
      );
      const hasDataset = phaseOne.dataset !== null;
      switch (hasDataset) {
        case false:
          await this.elder.saveRejectionReason(
            candidate.id,
            "DATA_DELIVERY_UNMET",
          );
          await this.elder.reflectLearning(
            candidate.id,
            "Data delivery unmet after retries",
          );
          continue;
        default:
          break;
      }

      let dataset = phaseOne.dataset as PITDataset;
      let dataAttempt = phaseOne.nextAttempt;
      await this.persistDataset(dataset);

      let retryMode: "MODEL" | "NONE" = "NONE";
      let verificationAttempt = 1;
      let completed = false;

      while (!completed && verificationAttempt <= 8) {
        const modelConfig = await this.quantResearcher.selectFoundationModel(
          candidate,
          dataset.context,
        );
        modelConfig.adaptationPolicy =
          await this.quantResearcher.designAdaptationPolicy(
            modelConfig.foundationModelId,
            candidate,
          );
        await this.elder.saveModelConfiguration(modelConfig);

        const refined = await this.quantResearcher.exploreFactors(
          candidate,
          dataset.context,
        );
        const verification = await this.quantResearcher.coOptimizeAndVerify(
          refined,
          dataset,
          modelConfig,
          retryMode,
          history.forbiddenZones,
        );
        await this.elder.saveVerificationResult(verification);

        const verdict = this.judgeVerification(verification, requirement);
        switch (verdict) {
          case "REJECTED_DATA": {
            await this.elder.reflectLearning(
              candidate.id,
              "Verification rejected by data",
            );
            const nextData = await this.acquireAcceptedDataset(
              requirement,
              candidate.id,
              dataAttempt,
            );
            const nextDataReady = nextData.dataset !== null;
            switch (nextDataReady) {
              case false:
                await this.elder.saveRejectionReason(
                  candidate.id,
                  "DATA_DELIVERY_UNMET",
                );
                await this.elder.reflectLearning(
                  candidate.id,
                  "Data retry exhausted after data-cause rejection",
                );
                completed = true;
                break;
              default:
                dataset = nextData.dataset as PITDataset;
                dataAttempt = nextData.nextAttempt;
                await this.persistDataset(dataset);
                retryMode = "NONE";
                break;
            }
            break;
          }
          case "REJECTED_MODEL":
            await this.elder.reflectLearning(
              candidate.id,
              "Verification rejected by model",
            );
            retryMode = "MODEL";
            break;
          case "REJECTED_GENERAL":
            await this.elder.saveRejectionReason(
              candidate.id,
              "REJECTED_GENERAL",
              verification.verification?.metrics,
            );
            await this.elder.reflectLearning(
              candidate.id,
              "General gate rejected candidate",
            );
            completed = true;
            break;
          case "ADOPTED":
            await this.handleAdoptedCandidate(
              candidate.id,
              verification,
              dataset.context,
            );
            completed = true;
            break;
        }

        verificationAttempt += 1;
      }
    }

    this.emitEvent("PIPELINE_COMPLETED", { requirementId: requirement.id });
  }

  private async handleAdoptedCandidate(
    candidateId: string,
    verification: VerificationResult,
    context: string,
  ): Promise<void> {
    const gate = this.cqo.auditStrategy(verification);
    const approved = gate.verdict === "APPROVED" && gate.isProductionReady;

    switch (approved) {
      case false: {
        const reason = gate.critique.join(", ") || "ORDER_GATE_REJECTED";
        await this.elder.saveRejectionReason(
          candidateId,
          "ORDER_GATE_REJECTED",
          reason,
        );
        await this.elder.reflectLearning(
          candidateId,
          `Order gate rejected: ${reason}`,
        );
        return;
      }
      default:
        break;
    }

    const raw = await this.executionAgent.optimizeAllocation(verification);
    const controlled = await this.executionAgent.applyRiskControl(raw);
    const plan = await this.executionAgent.optimizeHedge(controlled);
    plan.strategyId = candidateId;
    await this.elder.saveOrderPlan(plan);

    const execution = await this.executionAgent.execute(plan);
    const adoptionReason =
      verification.adoptionReason || `Adopted in context=${context}`;
    await this.elder.saveExecutionResult(execution, adoptionReason);

    const audit = await this.executionAgent.audit(execution);
    await this.elder.saveAuditRecord(audit);

    const drift = await this.executionAgent.analyzeDrift(audit);
    await this.elder.updateStatus(drift);
    await this.stateMonitor.recordDrift(drift);
  }

  private async acquireAcceptedDataset(
    requirement: PipelineRequirement,
    candidateId: string,
    startAttempt: number,
  ): Promise<{ dataset: PITDataset | null; nextAttempt: number }> {
    let attempt = startAttempt;
    let dataset: PITDataset | null = null;
    let accepted = false;

    while (!accepted && attempt <= 5) {
      const current = await this.dataEngineer.preparePITData(
        requirement,
        attempt,
      );
      current.context = await this.dataEngineer.generateScenario(current);
      dataset = current;
      accepted = this.isDataDeliveryAccepted(current, requirement);
      accepted ||
        (await this.elder.reflectLearning(
          candidateId,
          `Data delivery unmet at attempt=${attempt}, quality=${current.qualityScore}`,
        ));
      attempt += 1;
    }

    return {
      dataset: accepted ? dataset : null,
      nextAttempt: attempt,
    };
  }

  private async persistDataset(dataset: PITDataset): Promise<void> {
    await this.elder.saveDatasetInfo(
      dataset.id,
      {
        asOfDate: dataset.asOfDate,
        context: dataset.context,
        metadata: "PIT_CLEANED",
      },
      dataset.preprocessingConditions,
    );
  }

  private judgeVerification(
    result: VerificationResult,
    requirement: PipelineRequirement,
  ): VerificationVerdict {
    const modelOrDataVerdict: VerificationVerdict =
      result.failureType === "DATA"
        ? "REJECTED_DATA"
        : result.failureType === "MODEL"
          ? "REJECTED_MODEL"
          : "ADOPTED";

    switch (modelOrDataVerdict) {
      case "REJECTED_DATA":
        return "REJECTED_DATA";
      case "REJECTED_MODEL":
        return "REJECTED_MODEL";
      default:
        break;
    }

    const sharpe = result.verification?.metrics?.sharpeRatio ?? 0;
    const minSharpe = requirement.targetMetrics?.minSharpe ?? 1.5;
    return sharpe >= minSharpe ? "ADOPTED" : "REJECTED_GENERAL";
  }

  private isDataDeliveryAccepted(
    dataset: PITDataset,
    requirement: PipelineRequirement,
  ): boolean {
    const minSharpe = requirement.targetMetrics?.minSharpe ?? 1.5;
    const threshold = Math.max(0.75, Math.min(0.9, 0.7 + minSharpe * 0.05));
    return dataset.qualityScore >= threshold;
  }

  private async generateHighLevelIdeas(
    requirement: PipelineRequirement,
    history: { forbiddenZones: string[]; knowledge: string[] },
    currentState: Record<string, any>,
  ): Promise<IdeaCandidate[]> {
    const playbook = new ContextPlaybook();
    await playbook.load();

    for (const knowledge of history.knowledge) {
      playbook.addBullet({
        content: `[KNOWLEDGE]: ${knowledge}`,
        section: "domain_knowledge",
      });
    }

    const ideas: IdeaCandidate[] = [
      {
        id: `ID-${crypto.randomUUID().slice(0, 8)}`,
        requirementId: requirement.id,
        ast: {},
        description: "Mean Reversion Seed",
        reasoning: `Regime=${currentState.regime ?? "UNKNOWN"}`,
        noveltyScore: 0.9,
        priority: 0.9,
      },
      {
        id: `ID-${crypto.randomUUID().slice(0, 8)}`,
        requirementId: requirement.id,
        ast: {},
        description: "Momentum Seed",
        reasoning: "Current state favors momentum",
        noveltyScore: 0.7,
        priority: 0.85,
      },
      {
        id: `ID-${crypto.randomUUID().slice(0, 8)}`,
        requirementId: requirement.id,
        ast: {},
        description: "Random Noise Strategy",
        reasoning: "Forbidden-zone probe",
        noveltyScore: 0.1,
        priority: 0.1,
      },
    ];

    return ideas
      .filter(
        (idea) =>
          !history.forbiddenZones.some((zone: string) =>
            idea.description.includes(zone),
          ),
      )
      .sort((a, b) => b.priority - a.priority);
  }

  public async run(): Promise<void> {}
}
