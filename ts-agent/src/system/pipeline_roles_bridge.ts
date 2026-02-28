import { type IElder, type IDataEngineer, type IQuantResearcher, type IExecutionAgent, type PipelineRequirement, type IdeaCandidate, type PITDataset, type VerificationResult, type ExecutionResult, type ModelConfiguration } from "./pipeline_types.ts";
import { MemoryCenter, EventStore } from "../context/unified_context_services.ts";
import { LesAgent } from "../agents/latent_economic_signal_agent.ts";
import { core } from "./app_runtime_core.ts";

export class ElderBridge implements IElder {
  private memory = new MemoryCenter();

  async getHistory(requirementId: string): Promise<{ seeds: string[]; forbiddenZones: string[] }> {
    // In a real system, we'd query the memory database based on requirementId
    // For now, return some defaults or recent successes
    const successes = this.memory.getRecentSuccesses(5);
    return {
      seeds: successes.map((s: any) => s.description),
      forbiddenZones: ["Random Noise Strategy"]
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
    // Currently no specific table for datasets in MemoryCenter, use events
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
}

export class DataEngineerBridge implements IDataEngineer {
  async preparePITData(requirement: PipelineRequirement): Promise<PITDataset> {
    // Bridge to core.db or external providers
    console.log(`[DataEngineer] Preparing PIT data for ${requirement.universe.length} symbols...`);
    return {
      id: `ds-${Date.now()}`,
      asOfDate: new Date().toISOString().slice(0, 10),
      symbols: requirement.universe,
      features: ["close", "volume"],
      data: [{}], // Mock data
      context: "Market is in BULL_MOMENTUM"
    };
  }
}

export class QuantResearcherBridge implements IQuantResearcher {
  private les = new LesAgent();

  async research(candidate: IdeaCandidate, dataset: PITDataset): Promise<VerificationResult> {
    console.log(`[QuantResearcher] Researching candidate: ${candidate.description}`);
    
    // 1. Select Foundation Model & Adaptation Policy (Conceptual)
    const modelConfig: ModelConfiguration = {
      foundationModelId: "les-forecast-v1",
      adaptationPolicy: "LoRA",
      parameters: { learningRate: 1e-4 }
    };

    // 2. Perform Backtest/Evaluation
    // For now, mock a successful evaluation based on the candidate's priority
    const mockBacktest = {
      netReturn: candidate.priority * 0.2,
      sharpeRatio: candidate.priority * 3.0,
      tradingDays: 252,
      history: Array.from({ length: 20 }, () => candidate.priority * 0.01)
    };

    const outcome = this.les.calculateOutcome(
      candidate.id,
      candidate.noveltyScore,
      mockBacktest,
      [1, 2], // Mock predictions
      [1.1, 1.9], // Mock targets
      candidate.requirementId
    );

    return {
      ...outcome,
      modelConfig
    };
  }
}

export class ExecutionAgentBridge implements IExecutionAgent {
  async execute(strategyId: string, outcome: VerificationResult): Promise<ExecutionResult> {
    console.log(`[ExecutionAgent] Executing order for strategy: ${strategyId}`);
    return {
      orderId: `ord-${crypto.randomUUID().slice(0, 8)}`,
      strategyId,
      timestamp: new Date().toISOString(),
      status: "FILLED",
      averagePrice: 150.25,
      quantity: 100,
      executionReason: "Adopted by CQO with Sharpe > 1.5"
    };
  }
}
