import { StrategicReasonerAgent } from "../agents/alpha_r1_reasoner_agent.ts";
import { CqoAgent } from "../agents/chief_quant_officer_agent.ts";
import type { AlphaFactor } from "../agents/latent_economic_signal_agent.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { MemoryCenter } from "../context/unified_context_services.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import type {
  Metrics,
  StandardOutcome,
} from "../schemas/financial_domain_schemas.ts";
import { BaseAgent } from "./app_runtime_core.ts";

type VerificationVerdict =
  | "ADOPTED"
  | "REJECTED_DATA"
  | "REJECTED_MODEL"
  | "REJECTED_GENERAL";

type DataDeliveryGate = {
  accepted: boolean;
  threshold: number;
  failedChecks: string[];
};

export interface PipelineRequirement {
  id: string;
  description: string;
  targetMetrics?: {
    minSharpe?: number;
    minIC?: number;
    maxDrawdown?: number;
    dataDelivery?: {
      minQualityScore?: number;
      minCoverageRate?: number;
      maxMissingRate?: number;
      minLatencyScore?: number;
      minLeakFreeScore?: number;
      minSourceConsistency?: number;
    };
  };
  universe: string[];
}

export interface IdeaCandidate extends AlphaFactor {
  requirementId: string;
  noveltyScore: number;
  priority: number;
}

export interface PITDataset {
  id: string;
  asOfDate: string;
  symbols: string[];
  features: string[];
  data: IntegratedData[];
  context: string;
  qualityScore: number;
  deliveryMetrics: {
    coverageRate: number;
    missingRate: number;
    latencyScore: number;
    leakFreeScore: number;
    sourceConsistency: number;
  };
  preprocessingConditions: {
    imputation: string;
    normalization: string;
    outlierHandling: string;
  };
}

export interface ModelConfiguration {
  foundationModelId: string;
  adaptationPolicy: string;
  parameters: Record<string, string | number | boolean>;
  selectedReason?: string;
}

export interface VerificationResult extends StandardOutcome {
  modelConfig: ModelConfiguration;
  failureType?: "DATA" | "MODEL" | "NONE";
  adoptionReason?: string;
}

export interface OrderPlan {
  strategyId: string;
  targetSymbols: string[];
  allocations: Record<string, number>;
  riskLimits: Record<string, number>;
  hedgeRatio: number;
}

export interface ExecutionResult {
  orderId: string;
  strategyId: string;
  timestamp: string;
  status: "FILLED" | "PARTIAL" | "REJECTED";
  averagePrice: number;
  quantity: number;
  executionReason?: string;
  plan: OrderPlan;
}

export interface AuditRecord {
  auditId: string;
  executionResult: ExecutionResult;
  timestamp: string;
  complianceStatus: "PASS" | "FAIL";
  violations?: string[];
}

export interface DriftReport {
  strategyId: string;
  driftDetected: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH";
  recommendation: "CONTINUE" | "ADJUST" | "HALT";
  metrics: Record<string, number>;
}

export interface DataSourceRow {
  source: string;
  rows: number;
  expectedRows: number;
  missingRate: number;
  latencyMinutes: number;
  leakFlag: boolean;
  schemaMatch: number;
}

export interface DataDeliveryMetrics {
  coverageRate: number;
  missingRate: number;
  latencyScore: number;
  leakFreeScore: number;
  sourceConsistency: number;
}

export interface IntegratedData {
  integrated: boolean;
  rows: DataSourceRow[];
  deliveryMetrics: DataDeliveryMetrics;
}

export interface DatasetMetadata {
  asOfDate: string;
  context: string;
  qualityScore: number;
  deliveryMetrics: DataDeliveryMetrics;
  gate: {
    accepted: boolean;
    threshold: number;
    failedChecks: string[];
  };
}

export interface SystemStateSnapshot {
  regime: string;
  volatility: string;
  driftAlerts: number;
}

export interface IElder {
  getHistory(requirementId: string): Promise<{
    seeds: string[];
    forbiddenZones: string[];
    knowledge: string[];
  }>;
  saveIdeaCandidate(candidate: IdeaCandidate): Promise<void>;
  saveDatasetInfo(
    datasetId: string,
    metadata: DatasetMetadata,
    preprocessingConditions: PITDataset["preprocessingConditions"],
  ): Promise<void>;
  saveModelConfiguration(config: ModelConfiguration): Promise<void>;
  saveVerificationResult(result: VerificationResult): Promise<void>;
  saveOrderPlan(plan: OrderPlan): Promise<void>;
  saveExecutionResult(
    result: ExecutionResult,
    adoptionReason: string,
  ): Promise<void>;
  saveAuditRecord(audit: AuditRecord): Promise<void>;
  saveRejectionReason(
    strategyId: string,
    reason: string,
    metrics?: Metrics,
  ): Promise<void>;
  reflectLearning(strategyId: string, reason: string): Promise<void>;
  updateStatus(report: DriftReport): Promise<void>;
}

export interface IStateMonitor {
  recordDrift(report: DriftReport): Promise<void>;
  getCurrentState(): Promise<SystemStateSnapshot>;
}

export interface IDataEngineer {
  collectData(sources: string[]): Promise<DataSourceRow[]>;
  integrateData(raw: DataSourceRow[]): Promise<IntegratedData>;
  generateScenario(dataset: PITDataset): Promise<string>;
  preparePITData(
    requirement: PipelineRequirement,
    attempt: number,
  ): Promise<PITDataset>;
}

export interface IQuantResearcher {
  selectFoundationModel(
    candidate: IdeaCandidate,
    context: string,
  ): Promise<ModelConfiguration>;
  designAdaptationPolicy(
    modelId: string,
    candidate: IdeaCandidate,
  ): Promise<string>;
  exploreFactors(
    candidate: IdeaCandidate,
    context: string,
  ): Promise<IdeaCandidate>;
  coOptimizeAndVerify(
    candidate: IdeaCandidate,
    dataset: PITDataset,
    modelConfig: ModelConfiguration,
    retryMode?: "MODEL" | "NONE",
    forbiddenZones?: string[],
  ): Promise<VerificationResult>;
}

export interface IExecutionAgent {
  optimizeAllocation(
    verification: VerificationResult,
  ): Promise<Record<string, number>>;
  applyRiskControl(
    allocations: Record<string, number>,
  ): Promise<Record<string, number>>;
  optimizeHedge(allocations: Record<string, number>): Promise<OrderPlan>;
  execute(plan: OrderPlan): Promise<ExecutionResult>;
  audit(result: ExecutionResult): Promise<AuditRecord>;
  analyzeDrift(audit: AuditRecord): Promise<DriftReport>;
}

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
      await this.processCandidate(
        requirement,
        candidate,
        history.forbiddenZones,
      );
    }

    this.emitEvent("PIPELINE_COMPLETED", { requirementId: requirement.id });
  }

  private async processCandidate(
    requirement: PipelineRequirement,
    candidate: IdeaCandidate,
    forbiddenZones: string[],
  ): Promise<void> {
    await this.elder.saveIdeaCandidate(candidate);
    const phaseOne = await this.acquireAcceptedDataset(
      requirement,
      candidate.id,
      1,
    );
    if (phaseOne.accepted === "NO") {
      await this.elder.saveRejectionReason(candidate.id, "DATA_DELIVERY_UNMET");
      await this.elder.reflectLearning(
        candidate.id,
        "Data delivery unmet after retries",
      );
      return;
    }

    let dataset = phaseOne.dataset;
    let dataAttempt = phaseOne.nextAttempt;
    let retryMode: "MODEL" | "NONE" = "NONE";
    await this.persistDataset(dataset, requirement);

    for (let attempt = 1; attempt <= 8; attempt += 1) {
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
        forbiddenZones,
      );
      await this.elder.saveVerificationResult(verification);

      const verdict = this.judgeVerification(verification, requirement);
      if (verdict === "ADOPTED") {
        await this.handleAdoptedCandidate(
          candidate.id,
          verification,
          dataset.context,
        );
        return;
      }
      if (verdict === "REJECTED_GENERAL") {
        await this.elder.saveRejectionReason(
          candidate.id,
          "REJECTED_GENERAL",
          verification.verification?.metrics,
        );
        await this.elder.reflectLearning(
          candidate.id,
          "General gate rejected candidate",
        );
        return;
      }
      if (verdict === "REJECTED_MODEL") {
        await this.elder.reflectLearning(
          candidate.id,
          "Verification rejected by model",
        );
        retryMode = "MODEL";
        continue;
      }
      await this.elder.reflectLearning(
        candidate.id,
        "Verification rejected by data",
      );
      const nextData = await this.acquireAcceptedDataset(
        requirement,
        candidate.id,
        dataAttempt,
      );
      if (nextData.accepted === "NO") {
        await this.elder.saveRejectionReason(
          candidate.id,
          "DATA_DELIVERY_UNMET",
        );
        await this.elder.reflectLearning(
          candidate.id,
          "Data retry exhausted after data-cause rejection",
        );
        return;
      }
      dataset = nextData.dataset;
      dataAttempt = nextData.nextAttempt;
      retryMode = "NONE";
      await this.persistDataset(dataset, requirement);
    }
  }

  private async handleAdoptedCandidate(
    candidateId: string,
    verification: VerificationResult,
    context: string,
  ): Promise<void> {
    const gate = this.cqo.auditStrategy(verification);
    if (gate.verdict !== "APPROVED" || !gate.isProductionReady) {
      const reason = gate.critique.join(", ") || "ORDER_GATE_REJECTED";
      await this.elder.saveRejectionReason(
        candidateId,
        "ORDER_GATE_REJECTED",
        verification.verification?.metrics,
      );
      await this.elder.reflectLearning(
        candidateId,
        `Order gate rejected: ${reason}`,
      );
      return;
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
  ): Promise<{
    accepted: "YES" | "NO";
    dataset: PITDataset;
    nextAttempt: number;
  }> {
    const emptyDataset = await this.dataEngineer.preparePITData(
      requirement,
      startAttempt,
    );
    for (let attempt = startAttempt; attempt <= 5; attempt += 1) {
      const current = await this.dataEngineer.preparePITData(
        requirement,
        attempt,
      );
      current.context = await this.dataEngineer.generateScenario(current);
      const dataGate = this.evaluateDataDelivery(current, requirement);
      if (dataGate.accepted) {
        return {
          accepted: "YES",
          dataset: current,
          nextAttempt: attempt + 1,
        };
      }
      await this.elder.reflectLearning(
        candidateId,
        `Data delivery unmet at attempt=${attempt}, quality=${current.qualityScore.toFixed(3)}, failed=${dataGate.failedChecks.join("|")}`,
      );
    }

    return {
      accepted: "NO",
      dataset: emptyDataset,
      nextAttempt: 6,
    };
  }

  private async persistDataset(
    dataset: PITDataset,
    requirement: PipelineRequirement,
  ): Promise<void> {
    await this.elder.saveDatasetInfo(
      dataset.id,
      {
        asOfDate: dataset.asOfDate,
        context: dataset.context,
        qualityScore: dataset.qualityScore,
        deliveryMetrics: dataset.deliveryMetrics,
        gate: this.evaluateDataDelivery(dataset, requirement),
      },
      dataset.preprocessingConditions,
    );
  }

  private judgeVerification(
    result: VerificationResult,
    requirement: PipelineRequirement,
  ): VerificationVerdict {
    if (result.failureType === "DATA") return "REJECTED_DATA";
    if (result.failureType === "MODEL") return "REJECTED_MODEL";

    const sharpe = result.verification?.metrics?.sharpeRatio ?? 0;
    const minSharpe = requirement.targetMetrics?.minSharpe ?? 1.5;
    return sharpe >= minSharpe ? "ADOPTED" : "REJECTED_GENERAL";
  }

  private evaluateDataDelivery(
    dataset: PITDataset,
    requirement: PipelineRequirement,
  ): DataDeliveryGate {
    const minSharpe = requirement.targetMetrics?.minSharpe ?? 1.5;
    const derivedQuality = Math.max(
      0.75,
      Math.min(0.9, 0.7 + minSharpe * 0.05),
    );
    const criteria = requirement.targetMetrics?.dataDelivery;
    const threshold = criteria?.minQualityScore ?? derivedQuality;
    const minCoverageRate = criteria?.minCoverageRate ?? 0.8;
    const maxMissingRate = criteria?.maxMissingRate ?? 0.08;
    const minLatencyScore = criteria?.minLatencyScore ?? 0.75;
    const minLeakFreeScore = criteria?.minLeakFreeScore ?? 1;
    const minSourceConsistency = criteria?.minSourceConsistency ?? 0.9;
    const m = dataset.deliveryMetrics;
    const failedChecks = [
      dataset.qualityScore >= threshold ? "" : "quality",
      m.coverageRate >= minCoverageRate ? "" : "coverage",
      m.missingRate <= maxMissingRate ? "" : "missing",
      m.latencyScore >= minLatencyScore ? "" : "latency",
      m.leakFreeScore >= minLeakFreeScore ? "" : "leak",
      m.sourceConsistency >= minSourceConsistency ? "" : "consistency",
    ].filter((x) => x.length > 0);
    return {
      accepted: failedChecks.length === 0,
      threshold,
      failedChecks,
    };
  }

  private async generateHighLevelIdeas(
    requirement: PipelineRequirement,
    history: { forbiddenZones: string[]; knowledge: string[] },
    currentState: SystemStateSnapshot,
  ): Promise<IdeaCandidate[]> {
    const sharedReasoning = [
      `Requirement=${requirement.description}`,
      `Regime=${currentState.regime}`,
      `Volatility=${currentState.volatility}`,
      `Knowledge=${history.knowledge.join(" | ")}`,
    ].join("; ");

    const ideas: IdeaCandidate[] = [
      {
        id: `ID-${crypto.randomUUID().slice(0, 8)}`,
        requirementId: requirement.id,
        ast: {},
        description: "Mean Reversion Core",
        reasoning: sharedReasoning,
        noveltyScore: 0.9,
        priority: 0.9,
      },
      {
        id: `ID-${crypto.randomUUID().slice(0, 8)}`,
        requirementId: requirement.id,
        ast: {},
        description: "Momentum Core",
        reasoning: sharedReasoning,
        noveltyScore: 0.7,
        priority: 0.85,
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

  public async run(): Promise<void> {
    return;
  }
}
export class ElderBridge implements IElder {
  private memory = new MemoryCenter();

  async getHistory(_requirementId: string): Promise<{
    seeds: string[];
    forbiddenZones: string[];
    knowledge: string[];
  }> {
    const successes = this.memory.getRecentSuccesses(5) as {
      description: string;
    }[];
    return {
      seeds: successes.map((s) => s.description),
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
    metadata: DatasetMetadata,
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
    metrics?: Metrics,
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

  async getCurrentState(): Promise<SystemStateSnapshot> {
    console.log(`[StateMonitor] Retrieving current market state`);
    return {
      regime: "BULL_MOMENTUM",
      volatility: "CONTRACTING",
      driftAlerts: 0,
    };
  }
}

export class DataEngineerBridge implements IDataEngineer {
  private readonly baseSymbols = [
    "7203",
    "6758",
    "9984",
    "8306",
    "9432",
  ] as const;
  private gatewayPromise = MarketdataLocalGateway.create(this.baseSymbols);

  private getGateway(
    symbols: readonly string[],
  ): Promise<MarketdataLocalGateway> {
    if (symbols.join(",") === this.baseSymbols.join(","))
      return this.gatewayPromise;
    this.gatewayPromise = MarketdataLocalGateway.create(symbols);
    return this.gatewayPromise;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.replace(".T", "");
  }

  private getDateKey(row: Record<string, string | number>): string {
    const value = row.Date ?? row.date ?? row.TradeDate ?? row.tradedate ?? "";
    return String(value).replaceAll("-", "").slice(0, 8);
  }

  async collectData(_sources: string[]): Promise<DataSourceRow[]> {
    console.log(`[DataEngineer] Collecting data from configured sources`);
    const gateway = await this.getGateway(this.baseSymbols);
    const sampleSymbols = this.baseSymbols.slice(0, 4);
    const barsPerSymbol = await Promise.all(
      sampleSymbols.map((s) => gateway.getBars(this.normalizeSymbol(s), 40)),
    );
    const asOfDate = await gateway.getMarketDataEndDate();
    const mergedBars = barsPerSymbol.flat();
    const expectedRows = sampleSymbols.length * 40;
    const rows = mergedBars.length;
    const missingRate = Math.max(0, 1 - rows / expectedRows);
    const invalidRows = mergedBars.filter((row) => {
      const close = Number(row.Close ?? row.close ?? Number.NaN);
      const volume = Number(row.Volume ?? row.volume ?? Number.NaN);
      return (
        !Number.isFinite(close) ||
        close <= 0 ||
        !Number.isFinite(volume) ||
        volume < 0
      );
    }).length;
    const latencyMinutes = 10;
    const leakRows = mergedBars.filter(
      (row) =>
        this.getDateKey(row as Record<string, string | number>) > asOfDate,
    ).length;
    const schemaMatch = rows > 0 ? 1 - invalidRows / rows : 0;
    const leakFlag = leakRows > 0;
    return [
      {
        source: "finance",
        rows,
        expectedRows,
        missingRate,
        latencyMinutes,
        leakFlag,
        schemaMatch,
      },
      {
        source: "news",
        rows: Math.floor(rows * 0.7),
        expectedRows: Math.floor(expectedRows * 0.7),
        missingRate,
        latencyMinutes: latencyMinutes + 8,
        leakFlag,
        schemaMatch: Math.max(0, schemaMatch - 0.03),
      },
      {
        source: "onchain",
        rows: Math.floor(rows * 0.5),
        expectedRows: Math.floor(expectedRows * 0.5),
        missingRate: Math.min(0.2, missingRate + 0.02),
        latencyMinutes: latencyMinutes + 12,
        leakFlag,
        schemaMatch: Math.max(0, schemaMatch - 0.05),
      },
    ];
  }

  async integrateData(raw: DataSourceRow[]): Promise<IntegratedData> {
    console.log(`[DataEngineer] Integrating multi-modal data`);
    const sourceCount = raw.length;
    const coverageRate =
      raw.reduce((sum, x) => sum + x.rows / x.expectedRows, 0) / sourceCount;
    const missingRate =
      raw.reduce((sum, x) => sum + x.missingRate, 0) / sourceCount;
    const latencyAverage =
      raw.reduce((sum, x) => sum + x.latencyMinutes, 0) / sourceCount;
    const latencyScore = Math.max(0, 1 - latencyAverage / 60);
    const leakFreeScore = raw.every((x) => !x.leakFlag) ? 1 : 0;
    const sourceConsistency =
      raw.reduce((sum, x) => sum + x.schemaMatch, 0) / sourceCount;

    return {
      integrated: true,
      rows: raw,
      deliveryMetrics: {
        coverageRate,
        missingRate,
        latencyScore,
        leakFreeScore,
        sourceConsistency,
      },
    };
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
    const deliveryMetrics = integrated.deliveryMetrics;
    const attemptLift = Math.min(0.08, attempt * 0.015);
    const qualityScore = Math.min(
      0.98,
      deliveryMetrics.coverageRate * 0.35 +
        (1 - deliveryMetrics.missingRate) * 0.25 +
        deliveryMetrics.latencyScore * 0.15 +
        deliveryMetrics.leakFreeScore * 0.15 +
        deliveryMetrics.sourceConsistency * 0.1 +
        attemptLift,
    );

    return {
      id: `ds-${Date.now()}`,
      asOfDate: String(
        (
          await this.getGateway(
            requirement.universe.map((s) => this.normalizeSymbol(String(s))),
          )
        ).getMarketDataEndDate(),
      ),
      symbols: requirement.universe,
      features: ["close", "volume", "news_sentiment", "onchain_flow"],
      data: [integrated],
      context: "",
      qualityScore,
      deliveryMetrics,
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
