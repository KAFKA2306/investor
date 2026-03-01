import { readFileSync } from "node:fs";
import {
  type QuantitativeVerification,
  QuantitativeVerificationSchema,
} from "../schemas/financial_domain_schemas.ts";
import { paths } from "../system/path_registry.ts";

function std(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

function dailyReturnsFromCumulative(cumulativePct: number[]): number[] {
  const returns: number[] = new Array(cumulativePct.length).fill(0);
  for (let i = 1; i < cumulativePct.length; i++) {
    const prev = 1 + (cumulativePct[i - 1] ?? 0) / 100;
    const curr = 1 + (cumulativePct[i] ?? 0) / 100;
    returns[i] = curr / prev - 1;
  }
  return returns;
}

function verify(report: QuantitativeVerification): string[] {
  const issues: string[] = [];
  const n = report.dates.length;
  if (report.strategyCum.length !== n)
    issues.push("strategyCum length mismatch");
  if (report.benchmarkCum.length !== n)
    issues.push("benchmarkCum length mismatch");
  const symbols = Object.keys(report.individualData);
  if (symbols.length === 0) issues.push("individualData empty");
  for (const symbol of symbols) {
    const d = report.individualData[symbol];
    if (!d) continue;
    if (d.prices.length !== n) issues.push(`${symbol} prices length mismatch`);
    if (d.factors.length !== n)
      issues.push(`${symbol} factors length mismatch`);
    if (d.positions.length !== n)
      issues.push(`${symbol} positions length mismatch`);
  }

  const meanAbsSignal = new Array(n).fill(0);
  const meanPosition = new Array(n).fill(0);
  const tradeCount = new Array(n).fill(0);
  const positionState = new Set<number>();

  for (const symbol of symbols) {
    const d = report.individualData[symbol];
    if (!d) continue;
    for (let t = 0; t < n; t++) {
      const factor = d.factors[t] ?? 0;
      const pos = d.positions[t] ?? 0;
      meanAbsSignal[t] += Math.abs(factor) / symbols.length;
      meanPosition[t] += pos / symbols.length;
      positionState.add(pos);
      if (t > 0) {
        const prev = d.positions[t - 1] ?? 0;
        if (pos !== prev) tradeCount[t] += 1;
      }
    }
  }

  if (positionState.size <= 1)
    issues.push("all positions identical over full period");
  if (std(meanAbsSignal) < 1e-8) issues.push("alpha signal intensity is flat");
  if (std(meanPosition) < 1e-8) issues.push("portfolio position is flat");

  const netReturns = dailyReturnsFromCumulative(report.strategyCum);
  for (let t = 1; t < n; t++) {
    if (
      Math.abs(meanPosition[t] ?? 0) < 1e-10 &&
      (tradeCount[t] ?? 0) === 0 &&
      Math.abs(netReturns[t] ?? 0) > 1e-6
    ) {
      issues.push(`pnl exists with zero position at ${report.dates[t]}`);
      break;
    }
    if (
      (tradeCount[t] ?? 0) === 0 &&
      Math.abs((netReturns[t] ?? 0) - (netReturns[t - 1] ?? 0)) > 0.2
    ) {
      issues.push(`large pnl jump without trade at ${report.dates[t]}`);
      break;
    }
  }

  return issues;
}

const jsonPath = paths.verificationJson;
const raw = readFileSync(jsonPath, "utf8");
const report = QuantitativeVerificationSchema.parse(JSON.parse(raw));
const issues = verify(report);
const symbols = Object.keys(report.individualData);
const start = report.dates[0] ?? "";
const end = report.dates[report.dates.length - 1] ?? "";
console.log(
  JSON.stringify(
    {
      verification_consistency: {
        status: issues.length === 0 ? "PASS" : "FAIL",
        period: `${start}..${end}`,
        days: report.dates.length,
        symbols: symbols.length,
        strategyId: report.strategyId,
        issues,
      },
    },
    null,
    2,
  ),
);
if (issues.length > 0) {
  throw new Error(`verification consistency failed: ${issues.join("; ")}`);
}
