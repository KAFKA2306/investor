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
  data: any[]; // Simplified for now
  context: string;
}

export interface ModelConfiguration {
  foundationModelId: string;
  adaptationPolicy: string; // e.g., "LoRA", "Prompting", "Constraint-based"
  parameters: Record<string, any>;
}

export interface VerificationResult extends StandardOutcome {
  modelConfig: ModelConfiguration;
}

export interface ExecutionResult {
  orderId: string;
  strategyId: string;
  timestamp: string;
  status: "FILLED" | "PARTIAL" | "REJECTED";
  averagePrice: number;
  quantity: number;
  executionReason?: string;
}

/**
 * Roles from sequence.md
 */

export interface IElder {
  getHistory(requirementId: string): Promise<{ seeds: string[]; forbiddenZones: string[] }>;
  saveIdeaCandidate(candidate: IdeaCandidate): Promise<void>;
  saveDatasetInfo(datasetId: string, metadata: any): Promise<void>;
  saveVerificationResult(result: VerificationResult): Promise<void>;
  saveExecutionResult(result: ExecutionResult): Promise<void>;
  saveRejectionReason(strategyId: string, reason: string, metrics?: any): Promise<void>;
}

export interface IDataEngineer {
  preparePITData(requirement: PipelineRequirement): Promise<PITDataset>;
}

export interface IQuantResearcher {
  research(candidate: IdeaCandidate, dataset: PITDataset): Promise<VerificationResult>;
}

export interface IExecutionAgent {
  execute(strategyId: string, outcome: VerificationResult): Promise<ExecutionResult>;
}
