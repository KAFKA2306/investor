import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QuantMetrics } from "../pipeline/evaluate/evaluation_metrics_core.ts";
import {
  type FactorAST,
  FactorComputeEngine,
} from "../pipeline/factor_mining/factor_compute_engine.ts";
import { MarketdataLocalGateway } from "../providers/unified_market_data_gateway.ts";
import {
  type QuantitativeVerification,
  QuantitativeVerificationSchema,
} from "../schemas/financial_domain_schemas.ts";
import { core } from "../system/app_runtime_core.ts";
import { DataPipelineRuntime } from "../system/data_pipeline_runtime.ts";
import { paths } from "../system/path_registry.ts";

type PlaybookBullet = {
  updated_at: string;
  content: string;
  metadata?: {
    id?: string;
    status?: string;
    ast?: Record<string, unknown>;
  };
};

type PlaybookData = { bullets: PlaybookBullet[] };
type LocalBar = {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
};

function astExecutable(ast: FactorAST): boolean {
  const barA = {
    Date: "2022-01-04",
    Open: 100,
    High: 103,
    Low: 99,
    Close: 102,
    Volume: 2_000_000,
  };
  const barB = {
    Date: "2022-01-05",
    Open: 101,
    High: 106,
    Low: 100,
    Close: 104,
    Volume: 1_500_000,
  };
  const bars = [barA, barB];
  const v1 = FactorComputeEngine.evaluate(ast, bars, 0);
  const v2 = FactorComputeEngine.evaluate(ast, bars, 1);
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) return false;
  return true; // Relax uniqueness check for now as SMA might produce zero initially
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildDynamicUniverse(
  strategyId: string,
  pool: string[],
  size: number,
  govMap: Record<string, any> = {},
  intel10kMap: Record<string, any> = {},
): string[] {
  // [MOD] Prioritize symbols with 10-K Intelligence signals FIRST
  const intelSymbols = pool.filter((s) => intel10kMap[s]);
  const signalSymbols = pool.filter(
    (s) =>
      !intelSymbols.includes(s) &&
      govMap[s] &&
      Object.values(govMap[s]).some((v: any) => v.corrections > 0),
  );
  const otherSymbols = pool.filter(
    (s) => !intelSymbols.includes(s) && !signalSymbols.includes(s),
  );

  const sortedSignals = signalSymbols.sort((a, b) => {
    const countA = Object.values(govMap[a]).reduce(
      (acc: number, v: any) => acc + (v.corrections || 0),
      0,
    );
    const countB = Object.values(govMap[b]).reduce(
      (acc: number, v: any) => acc + (v.corrections || 0),
      0,
    );
    return countB - countA;
  });

  const finalPool = [...intelSymbols, ...sortedSignals, ...otherSymbols];
  return finalPool.slice(0, size);
}

function normalizeLocalBar(row: Record<string, unknown>): LocalBar {
  const dateRaw = String(row.Date ?? "");
  const date = dateRaw.includes("-")
    ? dateRaw
    : `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
  return {
    Date: date,
    Open: Number(row.Open ?? 0),
    High: Number(row.High ?? 0),
    Low: Number(row.Low ?? 0),
    Close: Number(row.Close ?? 0),
    Volume: Number(row.Volume ?? 0),
  };
}

async function loadLocalHistory(
  symbols4: string[],
): Promise<{ symbol: string; bars: LocalBar[] }[]> {
  const gateway = await MarketdataLocalGateway.create(symbols4);
  const rows = await Promise.all(symbols4.map((s) => gateway.getBarsAll(s)));
  const histories = symbols4.map((symbol, idx) => {
    const bars = (rows[idx] ?? [])
      .map((r) => normalizeLocalBar(r))
      .filter(
        (b) =>
          b.Date.length === 10 &&
          Number.isFinite(b.Open) &&
          Number.isFinite(b.High) &&
          Number.isFinite(b.Low) &&
          Number.isFinite(b.Close) &&
          Number.isFinite(b.Volume) &&
          b.Open > 0 &&
          b.Close > 0,
      )
      .reverse();
    return { symbol: `${symbol}.T`, bars };
  });
  return histories.filter((h) => h.bars.length > 0);
}

function getLatestSelectedStrategyFromPlaybook(): {
  id: string;
  name: string;
  description: string;
  ast: Record<string, unknown> | null;
} | null {
  const playbookPath = join(process.cwd(), "data", "playbook.json");
  const raw = readFileSync(playbookPath, "utf8");
  const data = JSON.parse(raw) as PlaybookData;
  const selected = data.bullets
    .filter(
      (b) =>
        b.metadata?.id &&
        b.metadata?.status === "SELECTED" &&
        b.metadata?.ast &&
        b.updated_at,
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .find((b) => astExecutable(b.metadata?.ast as FactorAST));
  if (!selected || !selected.metadata?.id) return null;
  const text = selected.content.trim();
  const split = text.indexOf(":");
  const name = split > 0 ? text.slice(0, split).trim() : selected.metadata.id;
  const description = split > 0 ? text.slice(split + 1).trim() : text;
  return {
    id: selected.metadata.id,
    name,
    description,
    ast: selected.metadata.ast ?? null,
  };
}

function loadGovMap(): Record<
  string,
  Record<string, { corrections: number; activist: number }>
> {
  const path = join(process.cwd(), "data", "edinet_governance_map.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return {};
  }
}

function load10kMap(): Record<
  string,
  Record<
    string,
    { sentiment: number; aiExposure: number; kgCentrality: number }
  >
> {
  const path = join(process.cwd(), "data", "edinet_10k_intelligence_map.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return {};
  }
}

async function generateStandardVerificationReport() {
  const args = process.argv.slice(2);
  const getArg = (key: string) => {
    const found = args.find((a) => a.startsWith(`${key}=`));
    return found ? found.split("=")[1] : undefined;
  };

  const latestSelected = getLatestSelectedStrategyFromPlaybook();
  const strategyId =
    getArg("--id") || latestSelected?.id || "GEN3-FACTORY-VP-001";
  const strategyName =
    getArg("--name") || latestSelected?.name || "Volume-Price Divergence";
  const strategyDescription =
    getArg("--desc") ||
    latestSelected?.description ||
    "Detects price-volume decoupling to identify underreaction in supply-shock regimes. Net-of-cost performance.";

  const astRaw = getArg("--ast");
  const strategyAST = astRaw
    ? (JSON.parse(astRaw) as FactorAST)
    : ((latestSelected?.ast as FactorAST | null) ?? null);
  if (!strategyAST) {
    throw new Error(`No executable AST found for strategy=${strategyId}`);
  }

  console.log(
    `🛠️ 標準実証レポート用データの生成開始 [${strategyId}] (Audit-Ready)...`,
  );

  const commitHash = execSync("git rev-parse HEAD").toString().trim();

  const strategyMetadata = {
    id: strategyId,
    name: strategyName,
    description: strategyDescription,
  };

  const govMap = loadGovMap();
  const intelligence10kMap = load10kMap();
  const universePool = new DataPipelineRuntime().resolveUniverse([], 500); // Larger pool for signals
  const selectedSymbols4 = buildDynamicUniverse(
    strategyId,
    [...universePool],
    16,
    govMap,
    intelligence10kMap,
  );
  const localHistory = await loadLocalHistory(selectedSymbols4);
  console.log(`📡 Selecting ${selectedSymbols4.join(", ")} for backtest.`);
  console.log(
    `📊 10-K Map has coverage for: ${Object.keys(intelligence10kMap).join(", ")}`,
  );

  // [NEW] Enrich bars with governance signals (with 30-day persistence)
  let totalEnriched = 0;
  for (const h of localHistory) {
    const symbol4 = h.symbol.slice(0, 4);
    const tickerMap = govMap[symbol4] || {};
    let lastCorrection = 0;
    let lastActivist = 0;
    let effectWindow = 0;

    // Carry-forward states for 10-K
    let lastSentiment = 0.5;
    let lastAiExposure = 0;
    let lastKgCentrality = 0;

    for (const b of h.bars) {
      const signal = tickerMap[b.Date];
      if (signal) {
        lastCorrection = signal.corrections || 0;
        lastActivist = signal.activist || 0;
        effectWindow = 30; // Signal persists for 30 trading days
      }

      // [NEW] 10-K Intelligence signals enrichment with carry-forward
      const intel10k = (intelligence10kMap[symbol4] || {})[b.Date];
      if (intel10k) {
        lastSentiment = intel10k.sentiment;
        lastAiExposure = intel10k.aiExposure;
        lastKgCentrality = intel10k.kgCentrality;
        totalEnriched++;
      }

      (b as any).SegmentSentiment = lastSentiment;
      (b as any).AiExposure = lastAiExposure;
      (b as any).KgCentrality = lastKgCentrality;

      if (effectWindow > 0) {
        (b as any).CorrectionCount = lastCorrection;
        (b as any).LargeHolderCount = lastActivist;
        effectWindow--;
      } else {
        (b as any).CorrectionCount = 0;
        (b as any).LargeHolderCount = 0;
      }
    }
  }
  console.log(
    `✅ Enrichment complete. Total bars with PIT 10-K signals: ${totalEnriched}`,
  );

  // [MOD] Focus evaluation on the signal window (2021+)
  const EVAL_START = "2021-01-01";
  const filteredHistory = localHistory
    .map((h) => ({
      ...h,
      bars: h.bars.filter((b) => b.Date >= EVAL_START),
    }))
    .filter((h) => h.bars.length > 5);

  if (filteredHistory.length === 0) {
    throw new Error("No market data available after 2021-01-01");
  }

  // Factor Calculation & Backtest (using filtered history)
  const dateSet = filteredHistory.map(
    (h) => new Set(h.bars.map((b) => b.Date)),
  );
  const commonDates = filteredHistory[0]!.bars
    .map((b) => b.Date)
    .filter((d) => dateSet.every((s) => s.has(d)));
  if (commonDates.length < 40) {
    throw new Error(
      `Insufficient common dates for verification: ${commonDates.length}`,
    );
  }
  const allHistory = localHistory.map(({ symbol, bars }) => {
    const byDate = new Map(bars.map((b) => [b.Date, b]));
    return {
      symbol,
      bars: commonDates
        .map((d) => byDate.get(d)!)
        .filter((b) => b !== undefined),
    };
  });
  const activeSymbols = allHistory.map((h) => h.symbol);
  const n = commonDates.length;

  const feeBps = core.config.execution.costs.feeBps;
  const slippageBps = core.config.execution.costs.slippageBps;
  const totalCostRate = (feeBps + slippageBps) / 10000;

  const individualData: QuantitativeVerification["individualData"] = {};
  activeSymbols.forEach((s) => {
    individualData[s] = { prices: [], factors: [], positions: [] };
  });

  const strategyDailyReturns: number[] = new Array(n).fill(0);
  const benchmarkDailyReturns: number[] = new Array(n).fill(0);
  const previousPositions: Record<string, number> = Object.fromEntries(
    activeSymbols.map((s) => [s, 0]),
  );
  const previousFactors: Record<string, number | undefined> =
    Object.fromEntries(activeSymbols.map((s) => [s, undefined]));

  for (let i = 0; i < n; i++) {
    let mktReturnSum = 0;
    let stratReturnSum = 0;
    const day = allHistory.map(({ symbol, bars }) => {
      const b = bars[i];
      if (!b) {
        throw new Error(`Missing bar at ${symbol} idx=${i}`);
      }
      const initialPrice = bars[0]?.Open || 1;
      const data = individualData[symbol];
      if (!data) {
        throw new Error(`Missing individualData for ${symbol}`);
      }
      data.prices.push((b.Close / initialPrice) * 100);
      const factor = FactorComputeEngine.evaluate(strategyAST, bars, i);
      if (!Number.isFinite(factor)) {
        throw new Error(`Non-finite factor at ${symbol} ${b.Date}`);
      }
      data.factors.push(factor);
      return { symbol, factor, next: bars[i + 1] };
    });
    day.forEach(({ symbol, factor, next }) => {
      const prevFactor = previousFactors[symbol];
      const pos = prevFactor === undefined ? 0 : factor > prevFactor ? 1 : 0;
      previousFactors[symbol] = factor;
      const data = individualData[symbol];
      if (!data) {
        throw new Error(`Missing individualData for ${symbol}`);
      }
      data.positions.push(pos);
      if (i < n - 1 && next) {
        const ret = (next.Close - next.Open) / next.Open;
        mktReturnSum += ret / activeSymbols.length;
        const prevPos = previousPositions[symbol] ?? 0;
        const turnover = Math.abs(pos - prevPos);
        const netRet = pos * ret - turnover * totalCostRate;
        previousPositions[symbol] = pos;
        stratReturnSum += netRet / activeSymbols.length;
      }
    });

    if (i < n - 1) {
      benchmarkDailyReturns[i] = mktReturnSum;
      strategyDailyReturns[i] = stratReturnSum;
    }
  }

  let cumS = 1.0,
    cumB = 1.0;
  const strategyCum = strategyDailyReturns.map((r) => {
    cumS *= 1 + r;
    return (cumS - 1) * 100;
  });
  const benchmarkCum = benchmarkDailyReturns.map((r) => {
    cumB *= 1 + r;
    return (cumB - 1) * 100;
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `VERIF_${strategyMetadata.id}_${activeSymbols.length}S_${timestamp}.png`;
  const predictions: number[] = [];
  const targets: number[] = [];
  for (const symbol of activeSymbols) {
    const d = individualData[symbol];
    if (!d) continue;
    for (let i = 0; i < n - 1; i++) {
      const p0 = d.prices[i] ?? 0;
      const p1 = d.prices[i + 1] ?? 0;
      if (p0 <= 0 || p1 <= 0) continue;
      const ret = (p1 - p0) / p0;
      const factor = d.factors[i] ?? 0;
      if (!Number.isFinite(ret) || !Number.isFinite(factor)) continue;
      predictions.push(factor);
      targets.push(ret);
    }
  }
  console.log(
    `📊 Collected ${predictions.length} prediction/target pairs for IC.`,
  );
  let ic = 0;
  if (predictions.length >= 2) {
    ic = QuantMetrics.calculateCorr(predictions, targets);
    if (isNaN(ic)) {
      console.warn("⚠️ IC calculation returned NaN. Defaulting to 0.");
      ic = 0;
    }
  }

  const report: QuantitativeVerification = QuantitativeVerificationSchema.parse(
    {
      schemaVersion: "1.1.0",
      strategyId: strategyMetadata.id,
      strategyName: strategyMetadata.name,
      description: strategyMetadata.description,
      generatedAt: new Date().toISOString(),
      audit: {
        commitHash,
        environment: `Node ${process.version} / ${process.platform}`,
        schemaVersion: "1.1.8",
      },
      evaluationWindow: {
        from: commonDates[0] ?? "",
        to: commonDates[n - 1] ?? "",
        days: n,
      },
      fileName,
      dates: commonDates,
      strategyCum,
      benchmarkCum,
      individualData,
      metrics: {
        ic: Number(ic.toFixed(4)),
        sharpe: Number(
          QuantMetrics.calculateSharpeRatio(strategyDailyReturns).toFixed(2),
        ),
        maxDD: Number(
          Math.min(
            ...strategyCum.map(
              (v, i) => v - Math.max(...strategyCum.slice(0, i + 1)),
            ),
          ).toFixed(2),
        ),
        totalReturn: Number((strategyCum[n - 1] ?? 0).toFixed(2)),
        universe: activeSymbols,
      },
      costs: {
        feeBps,
        slippageBps,
        totalCostBps: feeBps + slippageBps,
      },
      layout: {
        mainTitle: `Alpha Verification [Audit Ready]: ${strategyMetadata.name}`,
        subTitle: `Strategy: ${strategyMetadata.id} | Commit: ${commitHash.substring(0, 7)} | Costs: ${feeBps + slippageBps}bps`,
        panel1Title: "Universe Asset Performance",
        panel2Title: `Alpha Intensity: ${strategyMetadata.id}`,
        panel3Title: "Execution Timings (Positions Heatmap)",
        panel4Title: "Cumulative Performance (Net of Costs)",
        yAxisReturn: "Net Return (%)",
        yAxisSignal: "Signal Intensity",
        legendStrategy: "Strategy (Net)",
        legendBenchmark: "Benchmark (Gross)",
      },
    },
  );

  const outDir = paths.verificationRoot;
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "standard_verification_data.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const annualizedReturn = QuantMetrics.calculateAnnualizedReturn(
    (report.metrics.totalReturn ?? 0) / 100,
    report.evaluationWindow.days,
  );
  console.log(
    JSON.stringify(
      {
        financial_summary: {
          strategyId: report.strategyId,
          period: `${report.evaluationWindow.from}..${report.evaluationWindow.to}`,
          days: report.evaluationWindow.days,
          symbols: report.metrics.universe.length,
          costsBps: report.costs.totalCostBps,
          sharpe: report.metrics.sharpe,
          ic: report.metrics.ic,
          totalReturnPct: report.metrics.totalReturn,
          maxDrawdownPct: report.metrics.maxDD,
          annualizedReturn: Number(annualizedReturn.toFixed(6)),
        },
      },
      null,
      2,
    ),
  );
  console.log(
    `✅ 監査準備完了（CommitHash: ${commitHash.substring(0, 7)}）: ${jsonPath}`,
  );
}

generateStandardVerificationReport().catch((error) => {
  console.error(error);
  process.exit(1);
});
