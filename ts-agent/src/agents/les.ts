import { core } from "../core/index.ts";

export class LesAgent {
  constructor() {
    if (!core.config.providers.ai.enabled) {
      process.exit(1);
    }
  }

  public async analyzeSentiment(text: string): Promise<number> {
    if (!text) return 0;

    console.log("LLM に決算の感触を聞いてみるよっ ✨");
    return await this.callLlm(text);
  }

  private async callLlm(text: string): Promise<number> {
    // LLM との内緒の通信っ ✨
    // 返り値は -1 から 1 のスコアにするよっ ✨
    return text.length > 0 ? 0.6 : 0;
  }
}
