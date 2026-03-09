export interface Market {
  id: string;
  title: string;
  prices: { yes: number; no: number };
  spread: number;
  liquidity: number;
  timeToClose: number;
}

export interface ScanResult {
  marketId: string;
  liquidityScore: number;
  spread: number;
  timeRemaining: number;
  passedFilter: boolean;
}

export interface ResearchResult {
  marketId: string;
  sentimentScore: number;
  narrative: string;
}

export interface PredictionResult {
  marketId: string;
  pModelXgb: number;
  pModelLlm: number;
  pModelConsensus: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface RiskValidation {
  marketId: string;
  kellyCriterion: number;
  betSize: number;
  var95Loss: number;
  approved: boolean;
  reasoning: string;
}

export interface Signal {
  marketId: string;
  direction: "YES" | "NO";
  betSize: number;
  edge: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
}

export interface BacktestOutput {
  timestamp: string;
  window: string;
  signals: Signal[];
  metrics: {
    totalExposure: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  };
  learningUpdates: {
    lessonsLearned: string[];
    nextScanPriority: string[];
  };
}
