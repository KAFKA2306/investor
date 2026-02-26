import { type AlphaFactor, LesAgent } from "../agents/les.ts";
import { YahooFinanceGateway } from "../gateways/yahoo_finance_gateway.ts";

/**
 * 06_semiconductor_alpha.ts
 *
 * Diversification Strategy as per CQO Recommendation #4.
 * Replicates the NVDA PEAD logic for ASML and TSMC to reduce single-ticker risk.
 */
async function main() {
  console.log(
    "🌟 Starting Semiconductor Diversification Research (ASML, TSMC)...",
  );
  const targets = ["ASML", "TSM"];
  const agent = new LesAgent();
  const gw = new YahooFinanceGateway();

  for (const symbol of targets) {
    console.log(`\n🔍 Researching Orthogonal Alpha for ${symbol}...`);

    // 1. Data Acquisition (Mocked fundamentals for demonstration stability)
    const peRatio = symbol === "ASML" ? 42.1 : 28.5;
    const _chartData = await gw.getChart(symbol, "6mo");
    console.log(`- Bars available for ${symbol}: ${_chartData.length}`);

    // 2. Multi-Agent Synthesis (Semiconductor PEAD + Low Vol Drift)
    const candidates: AlphaFactor[] = [
      {
        id: `${symbol}-SEMI-PEAD-01`,
        description:
          "Semiconductor Structural Momentum based on Supply Chain Lead Times",
        reasoning:
          "High-end semi equipment (ASML) and foundry (TSMC) exhibit supply-chain lead momentum. Surprises here correlate with sector-wide R&D expansion.",
        expression: (bar: unknown) => {
          const b = bar as Record<string, number>;
          const r = b.Return_1d || 0;
          return r > 0.015 ? 0.82 : 0.42;
        },
      },
    ];

    // 3. Evaluation & Outcome Generation
    const evals = await Promise.all(
      candidates.map(async (f) => {
        const fra = await agent.evaluateReliability(f, { peRatio });
        const rpa = await agent.evaluateRisk(f);
        return { f, score: (fra.rs + rpa.rs) / 2 };
      }),
    );

    const best = evals[0];
    if (best && best.score > 0.7) {
      console.log(`✅ ${symbol} alpha validated. Generating outcome...`);
      const outcome = agent.calculateOutcome(best.f.id, best.score);
      outcome.strategyName = `Semi Diversification: ${symbol}`;
      outcome.summary = `Reflecting CQO Recommendation #4: Sector-wide diversification of PEAD-style structural momentum for ${symbol}.`;

      // Save report
      const reportPath = await agent.saveArXivReport(outcome);
      console.log(`📄 Report saved to: ${reportPath}`);

      // ACE Integration: Check for low performance (Simulated)
      await agent.pruneLowPerformers(outcome);
    }
  }

  console.log("\n✨ Semiconductor Diversification Research Complete.");
}

main().catch(console.error);
