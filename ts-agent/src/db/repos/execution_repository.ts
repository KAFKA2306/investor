import { BaseRepository } from "./base_repository.ts";

export type OrderPlanInput = {
  orderPlanId: string;
  runId?: string | null;
  signalId?: string | null;
  instrumentId: string;
  side: string;
  targetWeight: number;
  payloadJson?: Record<string, unknown>;
};

export type ExecutionFillInput = {
  fillId: string;
  orderPlanId: string;
  filledQty: number;
  fillPrice: number;
  slippageBps?: number | null;
  venueTs?: string | null;
};

export class ExecutionRepository extends BaseRepository<{ id: string }> {
  protected readonly table = "exec.order_plan";
  public async upsertOrderPlan(input: OrderPlanInput): Promise<void> {
    await this.executeUpsert({
      table: "exec.order_plan",
      conflictTarget: "order_plan_id",
      data: {
        order_plan_id: input.orderPlanId,
        run_id: input.runId ?? null,
        signal_id: input.signalId ?? null,
        instrument_id: input.instrumentId,
        side: input.side,
        target_weight: input.targetWeight,
        payload_json: this.toJson(input.payloadJson),
      },
      casts: {
        payload_json: "jsonb",
      },
    });
  }

  public async upsertExecutionFill(input: ExecutionFillInput): Promise<void> {
    await this.executeUpsert({
      table: "exec.execution_fill",
      conflictTarget: "fill_id",
      data: {
        fill_id: input.fillId,
        order_plan_id: input.orderPlanId,
        filled_qty: input.filledQty,
        fill_price: input.fillPrice,
        slippage_bps: input.slippageBps ?? null,
        venue_ts: input.venueTs ?? null,
      },
      casts: {
        venue_ts: "timestamptz",
      },
    });
  }
}
