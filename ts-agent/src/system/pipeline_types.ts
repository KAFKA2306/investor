import type { StandardOutcome } from "../schemas/financial_domain_schemas.ts";
import type { AlphaFactor } from "../agents/latent_economic_signal_agent.ts";

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
  data: any[];
  context: string;
  qualityScore: number; // 納入条件判定用
}

export interface ModelConfiguration {
  foundationModelId: string;
  adaptationPolicy: string;
  parameters: Record<string, any>;
}

export interface VerificationResult extends StandardOutcome {
  modelConfig: ModelConfiguration;
  failureType?: "DATA" | "MODEL" | "NONE";
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
}

export interface DriftReport {
  strategyId: string;
  driftDetected: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH";
  recommendation: "CONTINUE" | "ADJUST" | "HALT";
}

export interface IElder {
  getHistory(requirementId: string): Promise<{ seeds: string[]; forbiddenZones: string[]; knowledge: string[] }>;
  saveIdeaCandidate(candidate: IdeaCandidate): Promise<void>;
  saveDatasetInfo(datasetId: string, metadata: any): Promise<void>;
  saveVerificationResult(result: VerificationResult): Promise<void>;
  saveOrderPlan(plan: OrderPlan): Promise<void>;
  saveExecutionResult(result: ExecutionResult): Promise<void>;
  saveRejectionReason(strategyId: string, reason: string, metrics?: any): Promise<void>;
  reflectLearning(strategyId: string, reason: string): Promise<void>;
  updateStatus(report: DriftReport): Promise<void>;
}

export interface IDataEngineer {
  preparePITData(requirement: PipelineRequirement, attempt: number): Promise<PITDataset>;
  generateScenario(dataset: PITDataset): Promise<string>;
}

export interface IQuantResearcher {
  research(candidate: IdeaCandidate, dataset: PITDataset, retryMode?: "MODEL" | "NONE", forbiddenZones?: string[]): Promise<VerificationResult>;
}

export interface IExecutionAgent {
  optimizeAllocation(verification: VerificationResult): Promise<Record<string, number>>;
  applyRiskControl(allocations: Record<string, number>): Promise<Record<string, number>>;
  optimizeHedge(allocations: Record<string, number>): Promise<OrderPlan>;
  execute(plan: OrderPlan): Promise<ExecutionResult>;
  audit(result: ExecutionResult): Promise<AuditRecord>;
  analyzeDrift(audit: AuditRecord): Promise<DriftReport>;
}
