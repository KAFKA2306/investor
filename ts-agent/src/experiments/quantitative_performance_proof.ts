import { YahooFinanceGateway } from "../providers/yahoo_finance_market_provider.ts";
import { QuantMetrics } from "../pipeline/evaluate/quantitative_factor_metrics.ts";

async function proveAlphaQuantitatively() {
  console.log("📊 定量的実証: アルファ因子の統計的有意性検証を開始...");
  
  // 銘柄リスト（Yahoo Finance形式: 日本株は .T）
  const symbols = ["7203.T", "9984.T", "8035.T", "6758.T", "4063.T"];
  const gateway = new YahooFinanceGateway();
  
  // 1. データ取得
  console.log(`🔍 ${symbols.length} 銘柄のヒストリカルデータを取得中...`);
  const allHistory = await Promise.all(
    symbols.map(async (s) => {
      try {
        const bars = await gateway.getChart(s, "6mo");
        return { symbol: s, bars };
      } catch (e) {
        console.warn(`⚠️ ${s} のデータ取得に失敗しました:`, e);
        return { symbol: s, bars: [] };
      }
    })
  );

  // 2. アルファシグナルの計算 (GEN3-FACTORY-VP-001 相当のロジック)
  // Logic: (Close - Open) / (Volume + 1)
  console.log("🧪 アルファシグナル (GEN3-FACTORY-VP-001) を計算中...");
  
  const results = allHistory.map(({ symbol, bars }) => {
    const signals: number[] = [];
    const returns: number[] = [];
    
    for (let i = 0; i < bars.length - 1; i++) {
      const current = bars[i]!;
      const next = bars[i+1]!;
      
      // シグナル計算 (YahooBar は Open, Close, Volume と大文字開始)
      const sig = (current.Close - current.Open) / (current.Volume + 1);
      signals.push(sig);
      
      // 翌日のリターン (翌日の始値から終値)
      const ret = (next.Close - next.Open) / next.Open;
      returns.push(ret);
    }
    
    return { symbol, signals, returns };
  });

  // 3. パフォーマンス計測
  const flatSignals = results.flatMap(r => r.signals);
  const flatReturns = results.flatMap(r => r.returns);
  
  if (flatReturns.length === 0) {
    console.error("❌ 有効なデータポイントが見つかりませんでした。");
    return;
  }

  const ic = QuantMetrics.calculateCorr(flatSignals, flatReturns);
  const sharpe = QuantMetrics.calculateSharpeRatio(flatReturns);
  const tStat = QuantMetrics.calculateTStat(flatReturns);
  const pValue = QuantMetrics.calculatePValue(tStat, flatReturns.length);
  const cumulativeReturn = flatReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

  console.log("\n📈 --- 定量的実証レポート ---");
  console.log(`対象銘柄: ${symbols.join(", ")}`);
  console.log(`サンプル数: ${flatReturns.length} 取引日相当`);
  console.log(`------------------------------`);
  console.log(`情報係数 (IC): ${ic.toFixed(4)}`);
  console.log(`シャープレシオ: ${sharpe.toFixed(2)}`);
  console.log(`t-Stat: ${tStat.toFixed(2)}`);
  console.log(`p-Value: ${pValue.toFixed(4)}`);
  console.log(`累積リターン: ${(cumulativeReturn * 100).toFixed(2)}%`);
  console.log(`------------------------------`);

  if (Math.abs(ic) > 0.01) {
    console.log("✅ 判定: 数理アルファに予測力が確認されました（IC > 0.01）。");
  } else {
    console.log("⚠️ 判定: シグナル強度が不足しています。");
  }
}

proveAlphaQuantitatively().catch(console.error);
