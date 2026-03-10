import { core } from "../../system/app_runtime_core.ts";

export class PolygonScanGateway {
  private get apiKey(): string {
    return core.getEnv("POLYGONSCAN_API_KEY");
  }

  private get config() {
    const config = (core.config as unknown as { quant: { polygonscan_api_url: string } }).quant;
    return config || { polygonscan_api_url: "https://api-v2.polygonscan.com/api" };
  }

  public async getRecentTransactions(address: string) {
    const url = `${this.config.polygonscan_api_url}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${this.apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as { result: unknown[] };
    return data.result;
  }
}
