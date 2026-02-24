import type {
  IAcquirer,
  IConstructor,
  IEvaluator,
  IEvolver,
  IProcessor,
} from "./interfaces";

/**
 * ClosedLoopOrchestrator
 * Manages the lifecycle of a Context Engineering (CE) task.
 * Based on the OpenCE standard.
 */
export class ClosedLoopOrchestrator {
  constructor(
    private acquirer: IAcquirer,
    private processor: IProcessor,
    private constructor_: IConstructor,
    private evaluator: IEvaluator,
    private evolver: IEvolver,
  ) {}

  /**
   * Runs the full closed-loop pipeline.
   */
  async run(input: unknown): Promise<unknown> {
    console.log("OpenCE: Starting Closed-Loop Execution");

    // 1. Acquisition
    const rawData = (await this.acquirer.acquire()) as string[];
    console.log(`OpenCE (1/5): Acquired ${rawData.length} data points.`);

    // 2. Processing
    const processedContent = await this.processor.process(
      JSON.stringify(rawData),
    );
    console.log("OpenCE (2/5): Processed content.");

    // 3. Construction
    // In a real scenario, Construction might fetch from a Playbook.
    // For now, we pass the processed content as context bullets.
    const context = Array.isArray(rawData) ? rawData : [processedContent];
    const finalPrompt = await this.constructor_.construct(input, context);
    console.log("OpenCE (3/5): Constructed final prompt.");

    // 4. Execution (Simulated output for dummy run, or real LLM call)
    // Here we assume the input *is* the result for simulation purposes,
    // or we'd call an LLM client here.
    const executionOutput = input;

    // 5. Evaluation & Evolution
    const evaluation = await this.evaluator.evaluate(executionOutput);
    console.log(`OpenCE (4/5): Evaluated with score ${evaluation.score}.`);

    await this.evolver.evolve(evaluation);
    console.log("OpenCE (5/5): Evolution complete.");

    return {
      prompt: finalPrompt,
      evaluation,
    };
  }
}
