import { type IElder, type IDataEngineer, type IQuantResearcher, type IExecutionAgent, type PipelineRequirement, type IdeaCandidate, type VerificationResult } from "./pipeline_types.ts";
import { BaseAgent } from "./app_runtime_core.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { CqoAgent } from "../agents/chief_quant_officer_agent.ts";
import { StrategicReasonerAgent } from "../agents/alpha_r1_reasoner_agent.ts";
import { ContextPlaybook } from "../context/unified_context_services.ts";

/**
 * PipelineOrchestrator: The "Controller/統括" agent.
 * Follows the sequence diagram in docs/diagrams/sequence.md.
 */
export class PipelineOrchestrator extends BaseAgent {
  private les = new LesAgent();
  private cqo = new CqoAgent();
  private reasoner = new StrategicReasonerAgent();

  constructor(
    private readonly elder: IElder,
    private readonly dataEngineer: IDataEngineer,
    private readonly quantResearcher: IQuantResearcher,
    private readonly executionAgent: IExecutionAgent
  ) {
    super();
  }

  public async runPipeline(requirement: PipelineRequirement): Promise<void> {
    console.log(`[Orchestrator] Starting pipeline for: ${requirement.description}`);
    this.emitEvent("PIPELINE_STARTED", { requirementId: requirement.id });

    // 1. Get History from Elder
    const history = await this.elder.getHistory(requirement.id);
    console.log(`[Orchestrator] History retrieved: ${history.seeds.length} seeds, ${history.forbiddenZones.length} forbidden zones.`);

    // 2. Generate Ideas
    const candidates = await this.brainstorm(requirement, history);
    console.log(`[Orchestrator] Generated ${candidates.length} idea candidates.`);
    
    for (const candidate of candidates) {
      await this.elder.saveIdeaCandidate(candidate);
      
      // 3. Request PIT Data
      let dataset = await this.dataEngineer.preparePITData(requirement);
      
      // Data acceptance check
      if (!this.checkDataAcceptance(dataset)) {
        console.warn(`[Orchestrator] Data rejected for candidate ${candidate.id}. Requesting re-preparation...`);
        dataset = await this.dataEngineer.preparePITData(requirement); // One retry
      }
      await this.elder.saveDatasetInfo(dataset.id, { asOfDate: dataset.asOfDate, symbols: dataset.symbols });

      // 4. Research & Verification
      console.log(`[Orchestrator] Starting Research for: ${candidate.id}`);
      let verification = await this.quantResearcher.research(candidate, dataset);

      // 5. [Alpha-R1] Strategic Reasoning & Screening
      const reasoning = await this.reasoner.reasonAboutAlpha(verification, dataset.context);
      const screening = await this.reasoner.screenAlpha(verification, reasoning);
      
      verification.strategicReasoning = reasoning;
      verification.alphaScreening = screening;

      // 6. CQO Audit & Final Verdict
      const audit = this.cqo.auditStrategy(verification);
      console.log(`[Orchestrator] CQO Audit Verdict: ${audit.verdict} (Alpha-R1 Screening: ${screening.status})`);
      
      if (audit.verdict === "APPROVED" && screening.status === "ACTIVE") {
        console.log(`[Orchestrator] Strategy ADOPTED: ${candidate.id}`);
        await this.elder.saveVerificationResult(verification);
        
        // Final Adoption Logic (Order Gate)
        if (audit.isProductionReady) {
          const executionResult = await this.executionAgent.execute(candidate.id, verification);
          await this.elder.saveExecutionResult(executionResult);
          this.emitEvent("STRATEGY_EXECUTED", { strategyId: candidate.id, result: executionResult.status });
        } else {
          console.warn(`[Orchestrator] Strategy approved but NOT production ready. Skipping execution.`);
          await this.elder.saveRejectionReason(candidate.id, "ORDER_GATE_NOT_READY", verification.verification?.metrics);
        }
      } else {
        const rejectionLabel = screening.status !== "ACTIVE" ? `REJECTED_R1_${screening.status}` : `REJECTED_CQO_${audit.verdict}`;
        console.log(`[Orchestrator] Strategy REJECTED: ${candidate.id}. Reason: ${rejectionLabel}`);
        await this.elder.saveRejectionReason(candidate.id, rejectionLabel, verification.verification?.metrics);
        this.emitEvent("STRATEGY_REJECTED", { strategyId: candidate.id, reason: rejectionLabel });
      }
    }

    this.emitEvent("PIPELINE_COMPLETED", { requirementId: requirement.id });
  }

  private async brainstorm(requirement: PipelineRequirement, history: any): Promise<IdeaCandidate[]> {
    const playbook = new ContextPlaybook();
    await playbook.load();
    
    // Use LesAgent to generate factors
    const factors = await this.les.generateAlphaFactors(playbook.getBullets(), { count: 3 });
    
    // Map to IdeaCandidate
    return factors.map(f => ({
      ...f,
      requirementId: requirement.id,
      noveltyScore: 0.8, // Default for new generation
      priority: 0.75
    }));
  }

  private checkDataAcceptance(dataset: any): boolean {
    // Basic PIT consistency check placeholder
    return dataset.data.length > 0;
  }

  public async run(): Promise<void> {
    // Base class requirement
  }
}
