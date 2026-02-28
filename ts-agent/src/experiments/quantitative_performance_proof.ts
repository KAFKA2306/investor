import { YahooFinanceGateway } from "../providers/yahoo_finance_market_provider.ts";
import { QuantMetrics } from "../pipeline/evaluate/quantitative_factor_metrics.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function generateMultiFacetedEvidence() {
  console.log("📊 多角的実証: 証跡データの生成を開始...");
  
  const symbols = ["7203.T", "9984.T", "8035.T", "6758.T", "4063.T"];
  const gateway = new YahooFinanceGateway();
  
  const allHistory = await Promise.all(
    symbols.map(async (s) => ({
      symbol: s,
      bars: await gateway.getChart(s, "6mo")
    }))
  );

  const commonDates = allHistory[0]?.bars.map(b => b.Date) || [];
  const n = commonDates.length;
  
  // 多角的なメトリクスを保持
  const avgPrices: number[] = new Array(n).fill(0);
  const avgFactors: number[] = new Array(n).fill(0);
  const cumReturns: number[] = new Array(n).fill(0);
  const drawdowns: number[] = new Array(n).fill(0);
  
  let cum = 1.0;
  let runningMax = 1.0;

  // 各銘柄の価格を正規化して平均化（地合いの可視化）
  for (let i = 0; i < n; i++) {
    let priceSum = 0;
    let factorSum = 0;
    let dailyStrategyReturn = 0;

    allHistory.forEach(({ bars }) => {
      const b = bars[i];
      if (!b) return;
      
      // 価格の正規化（開始点を100とする）
      const initialPrice = bars[0]?.Close || 1;
      priceSum += (b.Close / initialPrice) * 100;

      // アルファ因子の計算 (Volume-Price Divergence)
      const factor = (b.Close - b.Open) / (b.Volume + 1e-9);
      factorSum += factor;

      // 翌日のリターンのための計算（バックテスト）
      if (i < n - 1) {
        const next = bars[i+1];
        if (next) {
          const ret = (next.Close - next.Open) / next.Open;
          // 負のICに基づく逆張り（factorが負なら買い、正なら売り）
          const signal = factor < 0 ? 1 : -1;
          dailyStrategyReturn += (signal * ret) / symbols.length;
        }
      }
    });

    avgPrices[i] = priceSum / symbols.length;
    avgFactors[i] = factorSum / symbols.length;
    
    if (i > 0) {
      cum *= (1 + dailyStrategyReturn);
      cumReturns[i] = (cum - 1) * 100;
      runningMax = Math.max(runningMax, cum);
      drawdowns[i] = (cum / runningMax - 1) * 100;
    }
  }

  const plotData = {
    dates: commonDates,
    avgPrices,
    avgFactors,
    cumReturns,
    drawdowns,
    symbols
  };
  
  const jsonPath = join(process.cwd(), "data", "multi_faceted_proof.json");
  writeFileSync(jsonPath, JSON.stringify(plotData, null, 2));
  console.log(`✅ 多角的エビデンスデータを保存しました: ${jsonPath}`);
}

generateMultiFacetedEvidence().catch(console.error);
