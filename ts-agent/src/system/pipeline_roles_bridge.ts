import { type IElder, type IDataEngineer, type IQuantResearcher, type IExecutionAgent, type PipelineRequirement, type IdeaCandidate, type PITDataset, type VerificationResult, type ExecutionResult, type ModelConfiguration, type OrderPlan, type AuditRecord, type DriftReport } from "./pipeline_types.ts";
import { MemoryCenter, EventStore } from "../context/unified_context_services.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { StrategicReasonerAgent } from "../agents/alpha_r1_reasoner_agent.ts";
import { core } from "./app_runtime_core.ts";

export class ElderBridge implements IElder {
  private memory = new MemoryCenter();

  async getHistory(requirementId: string): Promise<{ seeds: string[]; forbiddenZones: string[]; knowledge: string[] }> {
    const successes = this.memory.getRecentSuccesses(5);
    return {
      seeds: successes.map((s: any) => s.description),
      forbiddenZones: ["Random Noise Strategy", "High Leverage Martingale"],
      knowledge: ["Volatility spikes often lead to mean reversion.", "PEAD is stronger in small-cap."]
    };
  }

  async saveIdeaCandidate(candidate: IdeaCandidate): Promise<void> {
    this.memory.recordAlpha({
      id: candidate.id,
      experiment_id: candidate.requirementId,
      ast_json: JSON.stringify(candidate.ast),
      description: candidate.description,
      reasoning: candidate.reasoning,
      created_at: new Date().toISOString()
    });
  }

  async saveDatasetInfo(datasetId: string, metadata: any): Promise<void> {
    this.memory.pushEvent({
      type: "DATASET_PREPARED",
      payload: { datasetId, ...metadata }
    });
  }

  async saveVerificationResult(result: VerificationResult): Promise<void> {
    this.memory.recordEvaluation({
      id: crypto.randomUUID(),
      alpha_id: result.strategyId,
      market_date: result.timestamp.slice(0, 10),
      metrics_json: JSON.stringify(result.verification?.metrics),
      overall_score: result.reasoningScore || 0
    });
  }
  
  async saveOrderPlan(plan: OrderPlan): Promise<void> {
    this.memory.pushEvent({
      type: "SYSTEM_LOG",
      payload: { message: "Order Plan Saved", plan }
    });
  }

  async saveExecutionResult(result: ExecutionResult): Promise<void> {
    this.memory.pushEvent({
      type: "STRATEGY_EXECUTED",
      payload: result
    });
  }

  async saveRejectionReason(strategyId: string, reason: string, metrics?: any): Promise<void> {
    this.memory.pushEvent({
      type: "STRATEGY_REJECTED",
      payload: { strategyId, reason, metrics }
    });
  }
  
  async reflectLearning(strategyId: string, reason: string): Promise<void> {
    console.log(`[Elder] Learning reflected from rejection of ${strategyId}: ${reason}`);
    this.memory.pushEvent({
      type: "SYSTEM_LOG",
      payload: { message: "Learning Reflection", strategyId, reason }
    });
  }
  
  async updateStatus(report: DriftReport): Promise<void> {
    console.log(`[Elder] Status updated from Drift Report for ${report.strategyId}. Severity: ${report.severity}`);
  }
}

export class DataEngineerBridge implements IDataEngineer {
  async preparePITData(requirement: PipelineRequirement, attempt: number): Promise<PITDataset> {
    console.log(`[DataEngineer] Step 6: Preparing PIT data (Attempt: ${attempt})...`);
    // Integrate multiple hypothetical sources logically (Finance, News, On-chain)
    const qualityScore = Math.min(0.9, 0.7 + attempt * 0.1);
    
    return {
      id: `ds-${Date.now()}`,
      asOfDate: new Date().toISOString().slice(0, 10),
      symbols: requirement.universe,
      features: ["close", "volume", "news_sentiment", "onchain_flow"],
      data: [{}],
      context: "Market is in BULL_MOMENTUM",
      qualityScore
    };
  }
  
  async generateScenario(dataset: PITDataset): Promise<string> {
    // 4. Scenario Generation
    console.log(`[DataEngineer] Step 4(b): Generating context scenario for dataset ${dataset.id}`);
    return `Scenario: Bullish momentum with high retail participation. Volatility is contracting.`;
  }
}

export class QuantResearcherBridge implements IQuantResearcher {
  private les = new LesAgent();
  private reasoner = new StrategicReasonerAgent();

  async research(candidate: IdeaCandidate, dataset: PITDataset, retryMode: "MODEL" | "NONE" = "NONE", forbiddenZones: string[] = []): Promise<VerificationResult> {
    console.log(`[QuantResearcher] Step 11-16: Researching candidate with retryMode=${retryMode}`);
    
    if (forbiddenZones.some(fz => candidate.description.includes(fz))) {
       console.log(`[QuantResearcher] Warning: Candidate overlaps with forbidden zone.`);
    }

    // 12. Model Selection & 13. Adaptation Policy Design (Co-optimization mock)
    const modelConfig: ModelConfiguration = {
      foundationModelId: retryMode === "MODEL" ? "les-forecast-v2-refined" : "les-forecast-v1",
      adaptationPolicy: retryMode === "MODEL" ? "Prompt-Tuned & LoRA-adapted" : "LoRA",
      parameters: { learningRate: retryMode === "MODEL" ? 5e-5 : 1e-4 }
    };

    // 15. Backtest & Verification Optimization (Co-optimization)
    let failureType: VerificationResult["failureType"] = "NONE";
    if (candidate.id.includes("-1") && retryMode === "NONE") failureType = "MODEL";
    if (candidate.id.includes("-2") && dataset.qualityScore < 0.85) failureType = "DATA";

    const baseSharpe = failureType === "NONE" ? candidate.priority * 3.0 : 0.4;
    const optimizedSharpe = retryMode === "MODEL" ? baseSharpe * 1.2 : baseSharpe;

    const mockBacktest = {
      netReturn: candidate.priority * 0.2,
      sharpeRatio: optimizedSharpe,
      tradingDays: 252,
      history: Array.from({ length: 20 }, () => candidate.priority * 0.01)
    };

    const outcome = this.les.calculateOutcome(
      candidate.id,
      candidate.noveltyScore,
      mockBacktest,
      [1, 2],
      [1.1, 1.9],
      candidate.requirementId
    );

    const reasoning = await this.reasoner.reasonAboutAlpha(outcome, dataset.context);
    const screening = await this.reasoner.screenAlpha(outcome, reasoning);

    return {
      ...outcome,
      modelConfig,
      failureType,
      strategicReasoning: reasoning,
      alphaScreening: screening
    };
  }
}

export class ExecutionAgentBridge implements IExecutionAgent {
  
  async optimizeAllocation(verification: VerificationResult): Promise<Record<string, number>> {
    console.log(`[ExecutionAgent] Step 22-A: Optimizing allocations for ${verification.strategyId}`);
    return { "AAPL": 0.4, "MSFT": 0.6 };
  }

  async applyRiskControl(allocations: Record<string, number>): Promise<Record<string, number>> {
    console.log(`[ExecutionAgent] Step 22-B: Applying risk controls`);
    // Scale down if max position size exceeded
    return { "AAPL": 0.35, "MSFT": 0.5 };
  }

  async optimizeHedge(allocations: Record<string, number>): Promise<OrderPlan> {
    console.log(`[ExecutionAgent] Step 22-C: Optimizing hedges`);
    return {
      strategyId: "strategy-id",
      targetSymbols: Object.keys(allocations),
      allocations,
      riskLimits: { maxDrawdown: 0.05 },
      hedgeRatio: 0.2
    };
  }

  async execute(plan: OrderPlan): Promise<ExecutionResult> {
    console.log(`[ExecutionAgent] Step 24: Executing order for strategy: ${plan.strategyId}`);
    return {
      orderId: `ord-${crypto.randomUUID().slice(0, 8)}`,
      strategyId: plan.strategyId,
      timestamp: new Date().toISOString(),
      status: "FILLED",
      averagePrice: 150.25,
      quantity: 100,
      executionReason: "Capacity & Risk limits passed",
      plan
    };
  }
  
  async audit(result: ExecutionResult): Promise<AuditRecord> {
     console.log(`[ExecutionAgent] Step 25-A: Creating Audit Record for ${result.orderId}`);
     return {
         auditId: `aud-${crypto.randomUUID().slice(0, 8)}`,
         executionResult: result,
         timestamp: new Date().toISOString(),
         complianceStatus: "PASS"
     };
  }
  
  async analyzeDrift(audit: AuditRecord): Promise<DriftReport> {
      console.log(`[ExecutionAgent] Step 25-B: Analyzing drift for ${audit.executionResult.strategyId}`);
      return {
          strategyId: audit.executionResult.strategyId,
          driftDetected: false,
          severity: "LOW",
          recommendation: "CONTINUE"
      };
  }
}
