import { z } from "zod";

/**
 * UQTL (Unified Quantum Task Ledger) Event Schemas
 * Standardized event-sourced audit log for all agent activities.
 */

export const EventTypeSchema = z.enum([
  "MARKET_DATA_FETCHED",
  "ALPHA_GENERATED",
  "ALPHA_EVALUATED",
  "BACKTEST_COMPLETED",
  "STRATEGY_DECIDED",
  "OPERATOR_MUTATED",
  "SYSTEM_LOG",
  "ERROR_OCCURRED",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const BaseEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: EventTypeSchema,
  agentId: z.string().optional(),
  operatorId: z.string().optional(),
  experimentId: z.string().optional(),
  parentEventId: z.string().optional(), // Causality Link
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UQTLEvent = z.infer<typeof BaseEventSchema>;

/**
 * Specific Event Payloads (Conceptual Examples)
 */
export interface AlphaGeneratedEvent extends UQTLEvent {
  type: "ALPHA_GENERATED";
  payload: {
    factorId: string;
    ast: Record<string, unknown>;
    reasoning: string;
  };
}

export interface BacktestCompletedEvent extends UQTLEvent {
  type: "BACKTEST_COMPLETED";
  payload: {
    strategyId: string;
    netReturn: number;
    sharpe: number;
    tradingDays: number;
  };
}
