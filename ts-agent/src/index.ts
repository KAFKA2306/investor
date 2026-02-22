import { runParallel, writeDailyLog } from "./core.ts";
import type { KabuOrder } from "./schemas/kabucom.ts";
import type { ResultEntry, RiskEntry } from "./schemas/log.ts";
import type { PeadAnalysis } from "./schemas/pead.ts";

async function runDaily() {
  await runParallel(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  const now = new Date();
  const nowIso = now.toISOString();
  const date = nowIso.slice(0, 10).replaceAll("-", "");

  const signals: PeadAnalysis[] = [
    {
      symbol: "7203",
      sue: 2.1,
      sentimentScore: 0.42,
      isSurprise: true,
      targetPrice: 3520,
      analyzedAt: nowIso,
    },
  ];

  const risks: RiskEntry[] = [
    {
      strategyId: "A-01",
      kellyFraction: 0.12,
      lotSize: 100,
      stopLoss: 3380,
      takeProfit: 3600,
      decidedAt: nowIso,
    },
  ];

  const orders: KabuOrder[] = [
    {
      symbol: "7203",
      side: "2",
      orderType: 1,
      qty: 100,
    },
  ];

  const results: ResultEntry[] = [
    {
      symbol: "7203",
      orderId: "KABU-DEMO-001",
      status: "SUCCESS",
      executedPrice: 3498,
      pnl: 0,
      executedAt: nowIso,
    },
  ];

  writeDailyLog({
    date,
    version: "1.0.0",
    generatedAt: nowIso,
    signals,
    risks,
    orders,
    results,
    optimization: {
      thresholdAdjustments: {
        pead_sue_min: 2.0,
        sentiment_min: 0.3,
      },
      promptUpdates: [
        "Prioritize high-confidence PEAD with positive sentiment when volatility is calm.",
      ],
    },
  });
}

if (import.meta.main) {
  runDaily().catch((e) => {
    console.error("Error in daily workflow", e);
    process.exit(1);
  });
}
