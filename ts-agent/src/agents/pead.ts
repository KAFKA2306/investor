import { BaseAgent } from "../core/index.ts";
import { PeadJquantsGateway } from "../gateways/pead_market_gateway.ts";
import type { CalendarEntry, FinancialStatement } from "../schemas/pead.ts";
import { LesAgent } from "./les.ts";

export interface PeadDataProvider {
  getEarningsCalendar(params: Record<string, string>): Promise<CalendarEntry[]>;
  getStatements(params: Record<string, string>): Promise<FinancialStatement[]>;
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

    if (!latest || !previous) return;

    // 1. Standardized Unanticipated Earnings (SUE) Proxy
    // We factor in both NetIncome and Revenue for "Quality of Surprise"
    const incomeSurprise =
      (latest.NetIncome - previous.NetIncome) /
      Math.abs(previous.NetIncome || 1);
    const revenueSurprise =
      (latest.NetSales - previous.NetSales) / Math.abs(previous.NetSales || 1);

    // 2. Cross-Verification Logic
    // High Income Surprise + Negative Revenue is often just accounting/one-off items (Fake Surprise)
    const compositeSurprise = incomeSurprise * 0.7 + revenueSurprise * 0.3;

    const sentiment = await this.les.analyzeSentiment(
      `Earnings results for ${latest.LocalCode}: Sales ${latest.NetSales}, Income ${latest.NetIncome}`,
    );

    // 3. Precise Signal Generation (ArXiv-inspired thresholds)
    const isStrongPead =
      compositeSurprise > 0.15 && revenueSurprise > 0 && sentiment > 0.6;

    if (isStrongPead) {
      console.log(
        `[HYBRID PEAD SUCCESS] Symbol: ${latest.LocalCode}
         - Composite Surprise: ${(compositeSurprise * 100).toFixed(2)}%
         - Revenue Growth: ${(revenueSurprise * 100).toFixed(2)}%
         - Text Sentiment: ${sentiment.toFixed(2)}
         - Signal: STRONG LONG (Post-Earnings Drift)`,
      );
    }
  }
}

if (import.meta.main) {
  const agent = new PeadAgent(new PeadJquantsGateway(), new LesAgent());
  await agent.run();
}
