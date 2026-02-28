import { z } from "zod";
import { type EventType } from "../schemas/system_event_schemas.ts";

/**
 * ACE (Agentic Context Engineering) Playbook Schema
 * Based on ArXiv 2510.04618 and JRay-Lin/ace-agents
 */

/**
 * OpenCE (Open Control Engine) Contract Interfaces
 */
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

/**
 * Unified Intelligence Fabric (UIF)
 */
export const OperatorMetadataSchema = z.object({
  id: z.string(),
  version: z.number(),
  description: z.string(),
});

export type OperatorMetadata = z.infer<typeof OperatorMetadataSchema>;

export interface OperatorContext {
  operatorId: string;
  parentEventId: string | undefined;
}

export abstract class UIFOperator<TState, TEvent, TEffect> {
  public abstract readonly metadata: OperatorMetadata;

  public abstract process(
    state: TState,
    event: TEvent,
    context: OperatorContext,
  ): {
    effect: TEffect;
    newState: TState;
  };

  async emitEvent(
    type: EventType,
    payload: Record<string, unknown>,
    context: OperatorContext,
    metadata?: Record<string, unknown>,
  ) {
    const { core } = await import("./app_runtime_core.ts");
    core.eventStore.appendEvent({
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      operatorId: context.operatorId,
      parentEventId: context.parentEventId,
      payload,
      metadata,
    });
  }
}

export class UIFRuntime {
  private states = new Map<string, unknown>();

  public async execute<TState, TEvent, TEffect>(
    operator: UIFOperator<TState, TEvent, TEffect>,
    event: TEvent,
    parentEventId?: string,
  ): Promise<TEffect> {
    const operatorId = operator.metadata.id;
    if (!this.states.has(operatorId)) {
      this.states.set(operatorId, this.getInitialState(operator));
    }
    const state = this.states.get(operatorId) as TState;

    const context: OperatorContext = {
      operatorId: operator.metadata.id,
      parentEventId: parentEventId ?? undefined,
    };

    const { effect, newState } = operator.process(state, event, context);

    this.states.set(operator.metadata.id, newState);
    return effect;
  }

  private getInitialState(
    _operator: UIFOperator<unknown, unknown, unknown>,
  ): unknown {
    // In a real system, this might look up a manifest or use a factory
    return {};
  }
}

export const uifRuntime = new UIFRuntime();

/**
 * Orchestrator: Launches parallel agents.
 */
export class Orchestrator {
  private readonly agentCount: number;

  constructor(agentCount = 4) {
    this.agentCount = Number(process.env.UIF_AGENT_COUNT) || agentCount;
  }

  public async runParallel(task: () => Promise<void>) {
    const runId = globalThis.crypto.randomUUID();
    console.log(
      `[Orchestrator] Launching ${this.agentCount} parallel agents... ✨`,
    );
    await this.emitSystemEvent("RUN_STARTED", {
      runId,
      agentCount: this.agentCount,
    });
    try {
      const agents = Array.from({ length: this.agentCount }, (_, i) =>
        this.spawnAgent(i, task, runId),
      );
      await Promise.all(agents);
      await this.emitSystemEvent("RUN_FINISHED", {
        runId,
        agentCount: this.agentCount,
      });
      console.log("[Orchestrator] All parallel missions accomplished! ✨");
    } catch (error) {
      await this.emitSystemEvent("RUN_FAILED", {
        runId,
        agentCount: this.agentCount,
      });
      throw error;
    }
  }

  private async spawnAgent(id: number, task: () => Promise<void>, runId: string) {
    console.log(`[Orchestrator] Agent ${id} is starting mission... ✨`);
    await this.emitSystemEvent("AGENT_STARTED", { runId, agentId: id });
    try {
      await task();
      await this.emitSystemEvent("AGENT_COMPLETED", { runId, agentId: id });
      console.log(`[Orchestrator] Agent ${id} completed mission! ✨`);
    } catch (error) {
      await this.emitSystemEvent("AGENT_FAILED", {
        runId,
        agentId: id,
        reason: error instanceof Error ? error.message : String(error),
      });
      console.error(`[Orchestrator] Agent ${id} failed:`, error);
      throw error;
    }
  }

  private async emitSystemEvent(
    type: Extract<
      EventType,
      | "RUN_STARTED"
      | "RUN_FINISHED"
      | "RUN_FAILED"
      | "AGENT_STARTED"
      | "AGENT_COMPLETED"
      | "AGENT_FAILED"
    >,
    payload: Record<string, unknown>,
  ) {
    const { core } = await import("./app_runtime_core.ts");
    core.eventStore.appendEvent({
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      operatorId: "Orchestrator",
      payload,
    });
  }
}
