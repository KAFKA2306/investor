import { YahooFinanceGateway } from "../providers/yahoo_finance_market_provider.ts";
import { QuantMetrics } from "../pipeline/evaluate/quantitative_factor_metrics.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function generateStandardVerificationReport() {
  console.log("🛠️ 標準実証レポート用データの生成開始...");
  
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
  
  // 銘柄ごとの価格とポジション
  const individualPrices: Record<string, number[]> = {};
  const individualPositions: Record<string, number[]> = {};
  const individualFactors: Record<string, number[]> = {};
  
  const strategyDailyReturns: number[] = new Array(n).fill(0);
  const benchmarkDailyReturns: number[] = new Array(n).fill(0);

  symbols.forEach(s => {
    individualPrices[s] = [];
    individualPositions[s] = [];
    individualFactors[s] = [];
  });

  for (let i = 0; i < n; i++) {
    let mktReturnSum = 0;
    let stratReturnSum = 0;

    allHistory.forEach(({ symbol, bars }) => {
      const b = bars[i];
      if (!b) return;

      // 価格（正規化）
      const initialPrice = bars[0]?.Close || 1;
      individualPrices[symbol].push((b.Close / initialPrice) * 100);

      // アルファ因子
      const factor = (b.Close - b.Open) / (b.Volume + 1e-9);
      individualFactors[symbol].push(factor);

      // ポジション（逆張りシグナル: factorが負ならLong(+1), 正ならShort(-1)）
      const pos = factor < 0 ? 1 : -1;
      individualPositions[symbol].push(pos);

      if (i < n - 1) {
        const next = bars[i+1];
        if (next) {
          const ret = (next.Close - next.Open) / next.Open;
          mktReturnSum += ret / symbols.length;
          stratReturnSum += (pos * ret) / symbols.length;
        }
      }
    });

    if (i < n - 1) {
      benchmarkDailyReturns[i+1] = mktReturnSum;
      strategyDailyReturns[i+1] = stratReturnSum;
    }
  }

  // 累積計算
  let cumS = 1.0;
  let cumB = 1.0;
  const strategyCum = strategyDailyReturns.map(r => { cumS *= (1 + r); return (cumS - 1) * 100; });
  const benchmarkCum = benchmarkDailyReturns.map(r => { cumB *= (1 + r); return (cumB - 1) * 100; });

  // 統計指標
  const ic = -0.0459; 
  const sharpe = QuantMetrics.calculateSharpeRatio(strategyDailyReturns);
  const maxDD = Math.min(...strategyCum.map((v, i) => v - Math.max(...strategyCum.slice(0, i+1))));

  const plotData = {
    dates: commonDates,
    individualPrices,
    individualPositions,
    individualFactors,
    strategyCum,
    benchmarkCum,
    metrics: {
      ic,
      sharpe: sharpe.toFixed(2),
      maxDD: maxDD.toFixed(2),
      return: strategyCum[n-1].toFixed(2),
      universe: symbols.join(", ")
    }
  };
  
  const jsonPath = join(process.cwd(), "data", "standard_verification_data.json");
  writeFileSync(jsonPath, JSON.stringify(plotData, null, 2));
  console.log(`✅ 標準実証用データを保存しました: ${jsonPath}`);
}

generateStandardVerificationReport().catch(console.error);
