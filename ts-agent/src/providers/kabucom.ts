import {
  type KabuOrder,
  KabuOrderSchema,
  type KabuResponse,
} from "../schemas/kabucom.ts";

export class KabucomProvider {
  public async placeOrder(order: KabuOrder): Promise<KabuResponse> {
    await this.authenticate();

    const validated = KabuOrderSchema.parse(order);
    console.log(
      `Sending order to Kabucom symbol ${validated.symbol} side ${validated.side} qty ${validated.qty} ✨`,
    );

    const response: KabuResponse = { ResultCode: 0, OrderId: "KABU-12345678" };

    if (response.ResultCode !== 0) {
      console.log("注文がうまくいかなかったみたい... ✨");
      process.exit(1);
    }

    console.log(`注文が成就いたしたっ ✨ OrderId ${response.OrderId} ✨`);
    return response;
  }

  private async authenticate(): Promise<void> {
    console.log("au カブコム証券にログインするよっ ✨");
  }
}
