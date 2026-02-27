import { CqoAgent } from "../agents/cqo.ts";
import type { StandardOutcome } from "../schemas/outcome.ts";

async function testCqoAuditor() {
  console.log("🧪 Testing CQO Agent Auditor...");

  const cqo = new CqoAgent();

  // Case 1: A Weak Strategy
  const weakStrategy: StandardOutcome = {
    strategyId: "WEAK-001",
    strategyName: "Random Noise Tracker",
    timestamp: new Date().toISOString(),
    summary: "A strategy that essentially picks random stocks.",
    reasoningScore: 0.4,
    alpha: {
      tStat: 0.5,
      pValue: 0.6,
      informationCoefficient: 0.01,
    },
    verification: {
      metrics: {
        sharpeRatio: 0.8,
        maxDrawdown: 0.25,
        annualizedReturn: 0.02,
        directionalAccuracy: 0.48,
        mae: 0,
        rmse: 0,
        smape: 0,
      },
      upliftOverBaseline: 0,
    },
    stability: {
      trackingError: 0.05,
      tradingDaysHorizon: 252,
      isProductionReady: false,
    },
  };

  const audit1 = cqo.auditStrategy(weakStrategy);
  console.log("\nAudit Result for Weak Strategy:");
  console.log(cqo.generateAuditMarkdown(audit1));

  // Case 2: A Strong Strategy
  const strongStrategy: StandardOutcome = {
    strategyId: "STRONG-999",
    strategyName: "Mean Reversion Prime",
    timestamp: new Date().toISOString(),
    summary: "Highly reliable mean reversion in semiconductor stocks.",
    reasoningScore: 0.9,
    alpha: {
      tStat: 3.2,
      pValue: 0.001,
      informationCoefficient: 0.08,
    },
    verification: {
      metrics: {
        sharpeRatio: 2.1,
        maxDrawdown: 0.06,
        annualizedReturn: 0.18,
        directionalAccuracy: 0.62,
        mae: 0,
        rmse: 0,
        smape: 0,
      },
      upliftOverBaseline: 0.05,
    },
    stability: {
      trackingError: 0.01,
      tradingDaysHorizon: 252,
      isProductionReady: true,
    },
  };

  const audit2 = cqo.auditStrategy(strongStrategy);
  console.log("\nAudit Result for Strong Strategy:");
  console.log(cqo.generateAuditMarkdown(audit2));
}

testCqoAuditor().catch(console.error);
