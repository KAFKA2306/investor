import {
  type OperatorContext,
  type OperatorMetadata,
  UIFOperator,
} from "../uif_runtime.ts";

export interface MomentumState {
  lastPrice?: number;
}

export interface MomentumEvent {
  symbol: string;
  price: number;
}

export interface MomentumEffect {
  symbol: string;
  momentum: number;
  signal: "LONG" | "HOLD";
}

export class PriceMomentumOperator extends UIFOperator<
  MomentumState,
  MomentumEvent,
  MomentumEffect
> {
  public readonly metadata: OperatorMetadata = {
    id: "PriceMomentumOperator",
    version: 1,
    description: "Stateless operator for simple price momentum calculation.",
  };

  public process(
    state: MomentumState,
    event: MomentumEvent,
    context: OperatorContext,
  ) {
    const momentum = state.lastPrice
      ? (event.price - state.lastPrice) / state.lastPrice
      : 0;
    const signal = momentum > 0.02 ? "LONG" : "HOLD";

    const effect: MomentumEffect = {
      symbol: event.symbol,
      momentum,
      signal,
    };

    // Log decision within the fabric
    this.emitEvent(
      "STRATEGY_DECIDED",
      {
        symbol: event.symbol,
        momentum,
        signal,
        operatorId: this.metadata.id,
      },
      context,
    );

    return {
      effect,
      newState: { lastPrice: event.price },
    };
  }
}
