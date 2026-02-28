import type { AlphaFactor } from "../agents/latent_economic_signal_agent.ts";
import type {
  Metrics,
  StandardOutcome,
} from "../schemas/financial_domain_schemas.ts";

export interface PipelineRequirement {
  id: string;
  description: string;
  targetMetrics?: {
    minSharpe?: number;
    minIC?: number;
    maxDrawdown?: number;
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
  data: unknown[];
  context: string;
  qualityScore: number;
  preprocessingConditions: {
    imputation: string;
    normalization: string;
    outlierHandling: string;
  };
}

export interface ModelConfiguration {
  foundationModelId: string;
  adaptationPolicy: string;
  parameters: Record<string, unknown>;
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

export interface IElder {
  getHistory(requirementId: string): Promise<{
    seeds: string[];
    forbiddenZones: string[];
    knowledge: string[];
  }>;
  saveIdeaCandidate(candidate: IdeaCandidate): Promise<void>;
  saveDatasetInfo(
    datasetId: string,
    metadata: unknown,
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
  getCurrentState(): Promise<Record<string, unknown>>;
}

export interface IDataEngineer {
  collectData(sources: string[]): Promise<unknown[]>;
  integrateData(raw: unknown[]): Promise<unknown>;
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
