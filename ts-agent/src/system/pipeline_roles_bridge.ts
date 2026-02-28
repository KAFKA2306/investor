import { StrategicReasonerAgent } from "../agents/alpha_r1_reasoner_agent.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { MemoryCenter } from "../context/unified_context_services.ts";
import type {
  AuditRecord,
  DriftReport,
  ExecutionResult,
  IDataEngineer,
  IdeaCandidate,
  IElder,
  IExecutionAgent,
  IQuantResearcher,
  IStateMonitor,
  ModelConfiguration,
  OrderPlan,
  PITDataset,
  PipelineRequirement,
  VerificationResult,
} from "./pipeline_types.ts";

export class ElderBridge implements IElder {
  private memory = new MemoryCenter();

  async getHistory(_requirementId: string): Promise<{
    seeds: string[];
    forbiddenZones: string[];
    knowledge: string[];
  }> {
    const successes = this.memory.getRecentSuccesses(5);
    return {
      seeds: successes.map((s: any) => s.description),
      forbiddenZones: ["Random Noise Strategy", "High Leverage Martingale"],
      knowledge: [
        "Volatility spikes often lead to mean reversion.",
        "PEAD is stronger in small-cap.",
      ],
    };
  }

  async saveIdeaCandidate(candidate: IdeaCandidate): Promise<void> {
    this.memory.recordAlpha({
      id: candidate.id,
      experiment_id: candidate.requirementId,
      ast_json: JSON.stringify(candidate.ast),
      description: candidate.description,
      reasoning: candidate.reasoning,
      created_at: new Date().toISOString(),
    });
  }

  async saveDatasetInfo(
    datasetId: string,
    metadata: any,
    preprocessingConditions: PITDataset["preprocessingConditions"],
  ): Promise<void> {
    this.memory.pushEvent({
      type: "DATASET_PREPARED",
      payload: { datasetId, metadata, preprocessingConditions },
    });
  }

  async saveModelConfiguration(config: ModelConfiguration): Promise<void> {
    this.memory.pushEvent({
      type: "MODEL_CONFIG_SAVED",
      payload: { config },
    });
  }

  async saveVerificationResult(result: VerificationResult): Promise<void> {
    this.memory.recordEvaluation({
      id: crypto.randomUUID(),
      alpha_id: result.strategyId,
      market_date: result.timestamp.slice(0, 10),
      metrics_json: JSON.stringify(result.verification?.metrics),
      overall_score: result.reasoningScore || 0,
    });
  }

  async saveOrderPlan(plan: OrderPlan): Promise<void> {
    this.memory.pushEvent({
      type: "ORDER_PLAN_SAVED",
      payload: { message: "Order Plan Saved", plan },
    });
  }

  async saveExecutionResult(
    result: ExecutionResult,
    adoptionReason: string,
  ): Promise<void> {
    this.memory.pushEvent({
      type: "STRATEGY_EXECUTED",
      payload: { result, adoptionReason },
    });
  }

  async saveAuditRecord(audit: AuditRecord): Promise<void> {
    this.memory.pushEvent({
      type: "AUDIT_RECORD_SAVED",
      payload: { audit },
    });
  }

  async saveRejectionReason(
    strategyId: string,
    reason: string,
    metrics?: any,
  ): Promise<void> {
    this.memory.pushEvent({
      type: "STRATEGY_REJECTED",
      payload: { strategyId, reason, metrics },
    });
  }

  async reflectLearning(strategyId: string, reason: string): Promise<void> {
    console.log(
      `[Elder] Learning reflected from rejection/failure of ${strategyId}: ${reason}`,
    );
    this.memory.pushEvent({
      type: "SYSTEM_LOG",
      payload: { message: "Learning Reflection", strategyId, reason },
    });
  }

  async updateStatus(report: DriftReport): Promise<void> {
    console.log(
      `[Elder] Status updated from Drift Report for ${report.strategyId}. Severity: ${report.severity}`,
    );
  }
}

export class StateMonitorBridge implements IStateMonitor {
  private memory = new MemoryCenter();

  async recordDrift(report: DriftReport): Promise<void> {
    console.log(`[StateMonitor] Drift recorded: ${report.severity}`);
    this.memory.pushEvent({
      type: "STATE_UPDATED",
      payload: { component: "Drift", report },
    });
  }

  async getCurrentState(): Promise<Record<string, any>> {
    console.log(`[StateMonitor] Retrieving current market state`);
    return {
      regime: "BULL_MOMENTUM",
      volatility: "CONTRACTING",
      driftAlerts: 0,
    };
  }
}

export class DataEngineerBridge implements IDataEngineer {
  async collectData(sources: string[]): Promise<any[]> {
    console.log(
      `[DataEngineer] Collecting data from sources: ${sources.join(", ")}`,
    );
    return [
      { source: "finance", data: [] },
      { source: "onchain", data: [] },
    ];
  }

  async integrateData(raw: any[]): Promise<any> {
    console.log(`[DataEngineer] Integrating multi-modal data`);
    return { integrated: true, rawCount: raw.length };
  }

  async preparePITData(
    requirement: PipelineRequirement,
    attempt: number,
  ): Promise<PITDataset> {
    console.log(
      `[DataEngineer] Step 6: Preparing PIT data (Attempt: ${attempt})...`,
    );

    const rawData = await this.collectData([
      "finance",
      "news",
      "sns",
      "chart",
      "onchain",
    ]);
    const integrated = await this.integrateData(rawData);
    const qualityScore = Math.min(0.9, 0.6 + attempt * 0.15);

    return {
      id: `ds-${Date.now()}`,
      asOfDate: new Date().toISOString().slice(0, 10),
      symbols: requirement.universe,
      features: ["close", "volume", "news_sentiment", "onchain_flow"],
      data: [integrated],
      context: "",
      qualityScore,
      preprocessingConditions: {
        imputation: "forward_fill",
        normalization: "z_score_rolling_30d",
        outlierHandling: "winsorize_1_99",
      },
    };
  }

  async generateScenario(_dataset: PITDataset): Promise<string> {
    console.log(`[DataEngineer] Generating context scenario for dataset`);
    return "Scenario: Bullish momentum with high retail participation. Volatility is contracting.";
  }
}

export class QuantResearcherBridge implements IQuantResearcher {
  private les = new LesAgent();
  private reasoner = new StrategicReasonerAgent();

  async selectFoundationModel(
    _candidate: IdeaCandidate,
    context: string,
  ): Promise<ModelConfiguration> {
    console.log(
      `[QuantResearcher] Selecting Foundation Model based on context`,
    );
    return {
      foundationModelId: context.includes("Bullish")
        ? "les-forecast-v2-momentum"
        : "les-forecast-v1",
      adaptationPolicy: "",
      parameters: { learningRate: 1e-4 },
      selectedReason: `Context indicates ${context.slice(0, 10)}...`,
    };
  }

  async designAdaptationPolicy(
    modelId: string,
    _candidate: IdeaCandidate,
  ): Promise<string> {
    console.log(
      `[QuantResearcher] Designing Adaptation Policy for model: ${modelId}`,
    );
    return "LoRA + Prompt-Tuned Constraints";
  }

  async exploreFactors(
    candidate: IdeaCandidate,
    _context: string,
  ): Promise<IdeaCandidate> {
    console.log(
      `[QuantResearcher] Exploring factors for candidate: ${candidate.id}`,
    );
    return {
      ...candidate,
      noveltyScore: candidate.noveltyScore + 0.05,
    };
  }

  async coOptimizeAndVerify(
    candidate: IdeaCandidate,
    dataset: PITDataset,
    modelConfig: ModelConfiguration,
    retryMode: "MODEL" | "NONE" = "NONE",
    forbiddenZones: string[] = [],
  ): Promise<VerificationResult> {
    console.log(`[QuantResearcher] Co-optimizing factor, model, and backtest`);

    forbiddenZones.some((fz) => candidate.description.includes(fz)) &&
      console.log(`[QuantResearcher] Candidate overlaps with forbidden zone`);

    modelConfig.parameters.learningRate = retryMode === "MODEL" ? 5e-5 : 1e-4;

    const modelRejected = candidate.id.includes("-1") && retryMode === "NONE";
    const dataRejected =
      candidate.id.includes("-2") && dataset.qualityScore < 0.85;
    const failureType: VerificationResult["failureType"] = dataRejected
      ? "DATA"
      : modelRejected
        ? "MODEL"
        : "NONE";

    const baseSharpe = failureType === "NONE" ? candidate.priority * 3.0 : 0.4;
    const optimizedSharpe =
      retryMode === "MODEL" ? baseSharpe * 1.2 : baseSharpe;

    const mockBacktest = {
      from: "20250101",
      to: "20251231",
      netReturn: candidate.priority * 0.2,
      tradingDays: 252,
      feeBps: 1.0,
      slippageBps: 0.5,
      totalCostBps: 1.5,
      grossReturn: candidate.priority * 0.20015,
      pnlPerUnit: candidate.priority * 0.2,
      history: Array.from({ length: 20 }, () => candidate.priority * 0.01),
    };

    const outcome = this.les.calculateOutcome(
      candidate.id,
      candidate.noveltyScore,
      mockBacktest,
      [1, 2],
      [1.1, 1.9],
      candidate.requirementId,
    );

    const reasoning = await this.reasoner.reasonAboutAlpha(
      outcome,
      dataset.context,
    );
    const screening = await this.reasoner.screenAlpha(outcome, reasoning);

    return {
      ...outcome,
      modelConfig,
      failureType,
      strategicReasoning: reasoning,
      alphaScreening: screening,
      adoptionReason: `Co-optimization finished with Sharpe ${optimizedSharpe}`,
    };
  }
}

export class ExecutionAgentBridge implements IExecutionAgent {
  async optimizeAllocation(
    verification: VerificationResult,
  ): Promise<Record<string, number>> {
    console.log(
      `[ExecutionAgent] Step 22-A: Optimizing allocations for ${verification.strategyId}`,
    );
    return { AAPL: 0.4, MSFT: 0.6 };
  }

  async applyRiskControl(
    allocations: Record<string, number>,
  ): Promise<Record<string, number>> {
    console.log(`[ExecutionAgent] Step 22-B: Applying risk controls`);
    return Object.fromEntries(
      Object.entries(allocations).map(([symbol, weight]) => [
        symbol,
        weight * 0.85,
      ]),
    );
  }

  async optimizeHedge(allocations: Record<string, number>): Promise<OrderPlan> {
    console.log(`[ExecutionAgent] Step 22-C: Optimizing hedges`);
    return {
      strategyId: "strategy-id",
      targetSymbols: Object.keys(allocations),
      allocations,
      riskLimits: { maxDrawdown: 0.05 },
      hedgeRatio: 0.2,
    };
  }

  async execute(plan: OrderPlan): Promise<ExecutionResult> {
    console.log(
      `[ExecutionAgent] Step 24: Executing order for strategy: ${plan.strategyId}`,
    );
    return {
      orderId: `ord-${crypto.randomUUID().slice(0, 8)}`,
      strategyId: plan.strategyId,
      timestamp: new Date().toISOString(),
      status: "FILLED",
      averagePrice: 150.25,
      quantity: 100,
      executionReason: "Capacity and risk limits passed",
      plan,
    };
  }

  async audit(result: ExecutionResult): Promise<AuditRecord> {
    console.log(
      `[ExecutionAgent] Step 25-A: Creating Audit Record for ${result.orderId}`,
    );
    return {
      auditId: `aud-${crypto.randomUUID().slice(0, 8)}`,
      executionResult: result,
      timestamp: new Date().toISOString(),
      complianceStatus: "PASS",
    };
  }

  async analyzeDrift(audit: AuditRecord): Promise<DriftReport> {
    console.log(
      `[ExecutionAgent] Step 25-B: Analyzing drift for ${audit.executionResult.strategyId}`,
    );
    return {
      strategyId: audit.executionResult.strategyId,
      driftDetected: false,
      severity: "LOW",
      recommendation: "CONTINUE",
      metrics: { trackingError: 0.02 },
    };
  }
}
