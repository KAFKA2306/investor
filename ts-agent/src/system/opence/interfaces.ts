export interface EvaluationResult {
  score: number;
  feedback: string[];
  metadata: Record<string, unknown>;
}

export interface IEvaluator<TInput = unknown> {
  evaluate(output: TInput): Promise<EvaluationResult>;
}

export interface IProcessor {
  process(content: string): Promise<string>;
}

export interface IConstructor {
  construct(input: unknown, context: string[]): Promise<string>;
}

export interface IAcquirer {
  acquire(): Promise<string[]>;
}

export interface IEvolver {
  evolve(signal: EvaluationResult): Promise<void>;
}
