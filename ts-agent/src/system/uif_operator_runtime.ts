import { z } from "zod";
import { core } from "./core.ts";
import type { EventType } from "./uqtl.ts";

/**
 * Nova Generation 4: Unified Intelligence Fabric (UIF)
 *
 * An Operator is a stateless unit of intelligence.
 * (State, Event) => [Effect, NewState]
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

  // Core functional logic
  public abstract process(
    state: TState,
    event: TEvent,
    context: OperatorContext,
  ): {
    effect: TEffect;
    newState: TState;
  };

  protected emitEvent(
    type: EventType,
    payload: Record<string, unknown>,
    context: OperatorContext,
    metadata?: Record<string, unknown>,
  ) {
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

/**
 * Runtime that manages Operator execution and state transitions.
 */
export class UIFRuntime {
  private states = new Map<string, unknown>();

  public async execute<TState, TEvent, TEffect>(
    operator: UIFOperator<TState, TEvent, TEffect>,
    event: TEvent,
    parentEventId?: string,
  ): Promise<TEffect> {
    const state =
      (this.states.get(operator.metadata.id) as TState) ||
      this.getInitialState(operator);

    const context: OperatorContext = {
      operatorId: operator.metadata.id,
      parentEventId: parentEventId ?? undefined,
    };

    const { effect, newState } = operator.process(
      // biome-ignore lint/suspicious/noExplicitAny: intentional any for prototype state handling
      state as any,
      event,
      context,
      // biome-ignore lint/suspicious/noExplicitAny: intentional any for prototype state handling
    ) as any;

    this.states.set(operator.metadata.id, newState);

    return effect;
  }

  private getInitialState(
    _operator: UIFOperator<unknown, unknown, unknown>,
  ): unknown {
    return {}; // Simplified for prototype
  }
}

export const uifRuntime = new UIFRuntime();
