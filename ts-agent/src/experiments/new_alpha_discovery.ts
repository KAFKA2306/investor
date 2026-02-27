import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AlphaFactor } from "../agents/les.ts";
import { LesAgent } from "../agents/les.ts";
import { core } from "../core/index.ts";
import { ContextPlaybook } from "../core/playbook.ts";
import { MarketdataLocalGateway } from "../gateways/marketdata_local_gateway.ts";

const Universe = ["7203", "9984", "8035"];

type Snapshot = {
  symbol: string;
  bar: Record<string, number>;
  fin: Record<string, number>;
  dailyReturn: number;
};

type BaselineSeries = {
  name: string;
  sourceFile: string;
  scores: number[];
};

const pickNumber = (record: Record<string, number>, keys: string[]): number => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
};

const average = (values: number[]): number =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const pearsonCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n <= 1) return 0;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const meanX = average(xs);
  const meanY = average(ys);
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  if (denom <= 1e-12) return 0;
  return cov / denom;
};

const calcDailyReturn = (bar: Record<string, number>): number => {
  const open = pickNumber(bar, ["Open", "open"]);
  const close = pickNumber(bar, ["Close", "close"]);
  return (close - open) / Math.max(Math.abs(open), 1e-9);
};

const buildEvidence = (snapshots: Snapshot[]): Record<string, number> => {
  const ranges = snapshots.map((s) => {
    const high = pickNumber(s.bar, ["High", "high"]);
    const low = pickNumber(s.bar, ["Low", "low"]);
    const open = pickNumber(s.bar, ["Open", "open"]);
    return Math.abs(high - low) / Math.max(Math.abs(open), 1e-9);
  });
  const turnover = snapshots.map((s) =>
    pickNumber(s.bar, ["TurnoverValue", "turnoverValue"]),
  );
  const margins = snapshots.map((s) => {
    const sales = pickNumber(s.fin, ["NetSales", "netSales"]);
    const profit = pickNumber(s.fin, ["OperatingProfit", "operatingProfit"]);
    return sales !== 0
      ? profit / Math.max(Math.abs(sales), 1)
      : pickNumber(s.fin, ["ProfitMargin", "profitMargin"]);
  });
  return {
    sampleSize: snapshots.length,
    avgIntradayRange: average(ranges),
    avgTurnoverValue: average(turnover),
    avgProfitMargin: average(margins),
    positiveReturnRatio:
      snapshots.filter((s) => s.dailyReturn > 0).length /
      Math.max(1, snapshots.length),
  };
};

async function loadSnapshots(
  gateway: MarketdataLocalGateway,
  date: string,
): Promise<Snapshot[]> {
  const snapshots = await Promise.all(
    Universe.map(async (symbol) => {
      const [bars, fins] = await Promise.all([
        gateway.getDailyBars(symbol, [date]),
        gateway.getStatements(symbol),
      ]);
      const bar = bars[0] ?? {};
      const fin = fins[0] ?? {};
      return {
        symbol,
        bar,
        fin,
        dailyReturn: calcDailyReturn(bar),
      };
    }),
  );
  return snapshots;
}

async function loadBaselineSeries(
  symbols: readonly string[],
  snapshots: readonly Snapshot[],
): Promise<BaselineSeries> {
  const logsDir = join(core.config.paths.logs, "daily");
  const files = (await readdir(logsDir))
    .filter((file) => /^\d{8}\.json$/.test(file))
    .sort()
    .reverse();

  for (const file of files) {
    const raw = JSON.parse(
      await readFile(join(logsDir, file), "utf8"),
    ) as unknown;
    if (typeof raw !== "object" || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    if (obj.schema !== "investor.daily-log.v1") continue;
    if (typeof obj.report !== "object" || obj.report === null) continue;
    const report = obj.report as Record<string, unknown>;
    if (!Array.isArray(report.analysis)) continue;

    const scoreMap = new Map<string, number>();
    for (const row of report.analysis) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      if (typeof r.symbol !== "string") continue;
      if (typeof r.alphaScore !== "number" || !Number.isFinite(r.alphaScore))
        continue;
      scoreMap.set(r.symbol, r.alphaScore);
    }
    if (!symbols.every((symbol) => scoreMap.has(symbol))) continue;

    return {
      name: "latest-daily-alphaScore",
      sourceFile: file,
      scores: symbols.map((symbol) => scoreMap.get(symbol) ?? 0),
    };
  }

  return {
    name: "same-day-return-fallback",
    sourceFile: "N/A",
    scores: snapshots.map((snapshot) => snapshot.dailyReturn),
  };
}

function computeFactorScores(
  factor: AlphaFactor,
  snapshots: readonly Snapshot[],
): number[] {
  return snapshots.map((snapshot) =>
    factor.expression(snapshot.bar, snapshot.fin),
  );
}

async function discoverNewAlpha() {
  console.log("🌟 Starting New Alpha Discovery Experiment...");
  console.log("Context Isolation Mode: BLIND PLANNING");

  const startedAt = new Date().toISOString();
  const agent = new LesAgent();
  const gateway = await MarketdataLocalGateway.create(Universe);
  const date = await gateway.getMarketDataEndDate();
  const snapshots = await loadSnapshots(gateway, date);
  const evidence = buildEvidence(snapshots);
  const baseline = await loadBaselineSeries(Universe, snapshots);

  console.log(`Experimenting with market data up to: ${date}`);
  console.log(
    `Baseline for orthogonality check: ${baseline.name} (${baseline.sourceFile})`,
  );

  const factors = await agent.generateAlphaFactors({
    blindPlanning: true,
    targetDiversity: "HIGH",
  });

  console.log(`\n🔍 Found ${factors.length} potential Alpha Factors:`);
  factors.forEach((f) => {
    console.log(`- [${f.id}] ${f.description}`);
    console.log(`  Reasoning: ${f.reasoning}`);
  });

  console.log("\n⚖️ Evaluating Factors in isolation (Anti-Success Bias)...");
  const evaluations = await Promise.all(
    factors.map(async (factor) => {
      const fra = await agent.evaluateReliability(factor, evidence);
      const rpa = await agent.evaluateRisk(factor);
      const score = (fra.rs + rpa.rs) / 2;
      const factorScores = computeFactorScores(factor, snapshots);
      const orthCorrelation = pearsonCorrelation(factorScores, baseline.scores);
      const icProxy = pearsonCorrelation(
        factorScores,
        snapshots.map((snapshot) => snapshot.dailyReturn),
      );
      const orthogonality = 1 - Math.min(1, Math.abs(orthCorrelation));
      return {
        factor,
        fra,
        rpa,
        score,
        orthogonality,
        orthCorrelation,
        icProxy,
        meanSignal: average(factorScores),
      };
    }),
  );

  evaluations.forEach((result) => {
    console.log(`\nFactor: ${result.factor.id}`);
    console.log(`- Total Score: ${result.score.toFixed(2)}`);
    console.log(
      `- FRA: ${result.fra.rs > 0.7 ? "PASS" : "FAIL"} (${result.fra.logic})`,
    );
    console.log(
      `- RPA: ${result.rpa.rs > 0.7 ? "PASS" : "FAIL"} (${result.rpa.logic})`,
    );
    console.log(`- Orthogonality: ${result.orthogonality.toFixed(3)}`);
    console.log(`- Corr vs baseline: ${result.orthCorrelation.toFixed(3)}`);
    console.log(`- IC proxy: ${result.icProxy.toFixed(3)}`);
  });

  const highQualityAlpha = evaluations.filter(
    (result) =>
      result.score >= 0.75 &&
      Math.abs(result.orthCorrelation) <= 0.35 &&
      result.icProxy > 0,
  );

  if (highQualityAlpha.length > 0) {
    const playbook = new ContextPlaybook();
    await playbook.load();
    for (const result of highQualityAlpha) {
      playbook.addBullet({
        content: `[${result.factor.id}] ${result.factor.description} | orth=${result.orthogonality.toFixed(3)} | ic=${result.icProxy.toFixed(3)} | rationale=${result.factor.reasoning}`,
        section: "strategies_and_hard_rules",
        metadata: {
          source: "alpha_discovery",
          evaluatedAt: startedAt,
          baseline: baseline.name,
        },
      });
    }
    await playbook.save();
  }

  const report = {
    schema: "investor.alpha-discovery.v1",
    startedAt,
    endedAt: new Date().toISOString(),
    date,
    universe: [...Universe],
    evidence,
    baseline,
    candidates: evaluations.map((result) => ({
      id: result.factor.id,
      description: result.factor.description,
      reasoning: result.factor.reasoning,
      score: result.score,
      fra: result.fra.rs,
      rpa: result.rpa.rs,
      icProxy: result.icProxy,
      orthogonality: result.orthogonality,
      correlationToBaseline: result.orthCorrelation,
      meanSignal: result.meanSignal,
    })),
    selected: highQualityAlpha.map((result) => result.factor.id),
  };

  const outputDir = join(core.config.paths.logs, "unified");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(
    outputDir,
    `alpha_discovery_${date}_${Date.now()}.json`,
  );
  await writeFile(outputPath, JSON.stringify(report, null, 2));

  console.log(
    `\n✨ Discovery Complete. ${highQualityAlpha.length} factors identified as Production Ready.`,
  );
  console.log(`📝 Discovery report saved to: ${outputPath}`);
}

discoverNewAlpha().catch((error) => {
  console.error("Alpha discovery failed:", error);
  process.exit(1);
});
