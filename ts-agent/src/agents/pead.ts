import { BaseAgent } from "../core/index.ts";
import { PeadJquantsGateway } from "../gateways/pead_market_gateway.ts";
import { LesAgent } from "./les.ts";

interface CalendarEntry {
  code: string;
}

interface FinancialStatement {
  LocalCode: string;
  NetIncome: number;
}

export interface PeadDataProvider {
  getEarningsCalendar(params: Record<string, string>): Promise<unknown[]>;
  getStatements(params: Record<string, string>): Promise<unknown[]>;
}

export interface SentimentAnalyzer {
  analyzeSentiment(text: string): Promise<number>;
}

export class PeadAgent extends BaseAgent {
  constructor(
    private readonly jquants: PeadDataProvider,
    private readonly les: SentimentAnalyzer,
  ) {
    super();
  }

  public async run() {
    const today = new Date().toISOString().split("T")[0];
    if (!today) return;

    const calendar = (await this.jquants.getEarningsCalendar({
      date: today,
    })) as unknown as CalendarEntry[];

    for (const entry of calendar) {
      const statements = (await this.jquants.getStatements({
        code: entry.code,
      })) as unknown as FinancialStatement[];
      await this.analyze(statements);
    }
  }

  private async analyze(statements: FinancialStatement[]) {
    if (statements.length < 2) return;

    const latest = statements[0];
    const previous = statements[1];

    if (!latest || !previous || previous.NetIncome === 0) return;

    const surprise =
      (latest.NetIncome - previous.NetIncome) / Math.abs(previous.NetIncome);

    const sentiment = await this.les.analyzeSentiment(
      "Mock financial text content",
    );

    if (surprise > 0.2 && sentiment > 0.3) {
      console.log(
        `[HYBRID PEAD SUCCESS] Code: ${latest.LocalCode}, Surprise: ${surprise}, Sentiment: ${sentiment}`,
      );
    }
  }
}

if (import.meta.main) {
  const agent = new PeadAgent(new PeadJquantsGateway(), new LesAgent());
  await agent.run();
}
