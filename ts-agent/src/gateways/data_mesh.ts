import { type Observable, Subject } from "rxjs";
import { filter } from "rxjs/operators";
import { z } from "zod";

/**
 * Nova Generation 4: Streaming Data Mesh (SDM)
 *
 * Replaces polling-based gateways with a reactive event stream.
 */

export const MarketEventSchema = z.object({
  symbol: z.string(),
  type: z.enum(["BAR", "STATEMENT", "SIGNAL"]),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type MarketEvent = z.infer<typeof MarketEventSchema>;

export class DataMesh {
  private mainStream = new Subject<MarketEvent>();

  /**
   * Publish an event to the mesh.
   */
  public publish(event: MarketEvent) {
    this.mainStream.next(event);
  }

  /**
   * Subscribe to specific symbols or event types.
   */
  public observe(
    filterFn?: (event: MarketEvent) => boolean,
  ): Observable<MarketEvent> {
    if (!filterFn) return this.mainStream.asObservable();
    return this.mainStream.asObservable().pipe(filter(filterFn));
  }

  /**
   * Helper to observe a specific symbol.
   */
  public observeSymbol(symbol: string): Observable<MarketEvent> {
    return this.observe((e) => e.symbol === symbol);
  }
}

export const dataMesh = new DataMesh();
