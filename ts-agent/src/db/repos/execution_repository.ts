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

export class ExecutionRepository extends BaseRepository {
  public async upsertOrderPlan(input: OrderPlanInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO exec.order_plan
      (order_plan_id, run_id, signal_id, instrument_id, side, target_weight, payload_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(order_plan_id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        signal_id = EXCLUDED.signal_id,
        instrument_id = EXCLUDED.instrument_id,
        side = EXCLUDED.side,
        target_weight = EXCLUDED.target_weight,
        payload_json = EXCLUDED.payload_json
      `,
      [
        input.orderPlanId,
        input.runId ?? null,
        input.signalId ?? null,
        input.instrumentId,
        input.side,
        input.targetWeight,
        input.payloadJson ? JSON.stringify(input.payloadJson) : null,
      ],
    );
  }

  public async upsertExecutionFill(input: ExecutionFillInput): Promise<void> {
    await this.db.query(
      `
      INSERT INTO exec.execution_fill
      (fill_id, order_plan_id, filled_qty, fill_price, slippage_bps, venue_ts)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
      ON CONFLICT(fill_id) DO UPDATE SET
        order_plan_id = EXCLUDED.order_plan_id,
        filled_qty = EXCLUDED.filled_qty,
        fill_price = EXCLUDED.fill_price,
        slippage_bps = EXCLUDED.slippage_bps,
        venue_ts = EXCLUDED.venue_ts
      `,
      [
        input.fillId,
        input.orderPlanId,
        input.filledQty,
        input.fillPrice,
        input.slippageBps ?? null,
        input.venueTs ?? null,
      ],
    );
  }
}
