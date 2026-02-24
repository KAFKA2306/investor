/**
 * OpenCE (Open Context Engineering) Standard Interfaces
 * Based on sci-m-wang/OpenCE Five Pillars Architecture
 */

/**
 * Pillar 1: Acquisition
 * Responsible for fetching raw information/data.
 */
export interface IAcquirer {
  acquire(): Promise<unknown>;
}

/**
 * Pillar 2: Processing
 * Responsible for cleaning, deduplicating, or compressing context.
 */
export interface IProcessor {
  process(content: string): Promise<string>;
}

/**
 * Pillar 3: Construction
 * Responsible for assembling the final prompt context (Few-Shot, etc.).
 */
export interface IConstructor {
  construct(input: unknown, context: string[]): Promise<string>;
}

/**
 * Pillar 4: Evaluation
 * Responsible for scoring/analyzing LLM outputs.
 */
export interface IEvaluator {
  evaluate(output: unknown): Promise<EvaluationResult>;
}

/**
 * Pillar 5: Evolution
 * Responsible for updating the knowledge base (Playbook) based on signals.
 */
export interface IEvolver {
  evolve(signal: EvaluationResult): Promise<void>;
}

export interface EvaluationResult {
  score: number;
  feedback: string[];
  metadata: Record<string, unknown>;
}
