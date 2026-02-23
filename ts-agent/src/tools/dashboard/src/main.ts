import "./style.css";

interface LogPayload {
  schema?: string;
  generatedAt?: string;
  models?: Array<Record<string, unknown>>;
  report?: DashboardReport | StandardOutcome;
}

interface StandardOutcome {
  strategyId: string;
  strategyName: string;
  timestamp: string;
  summary: string;
  reasoning?: string;
  reasoningScore?: number; // RS (0.0-1.0)
  alpha?: {
    tStat?: number;
    pValue?: number;
    informationCoefficient?: number;
    numerai?: {
      corr?: number;
      mmc?: number;
      fnc?: number;
    };
    famaFrench?: {
      mkt?: number;
      smb?: number;
      hml?: number;
      rmw?: number;
      cma?: number;
    };
  };
  verification?: {
    metrics: {
      mae?: number;
      rmse?: number;
      smape?: number;
      directionalAccuracy?: number;
      sharpeRatio?: number;
      annualizedReturn?: number;
      maxDrawdown?: number;
    };
    upliftOverBaseline?: number;
  };
  stability?: {
    trackingError: number;
    tradingDaysHorizon: number;
    isProductionReady: boolean;
  };
  execution?: {
    totalPnL?: number;
    trackingError?: number;
    slippageImpactBps?: number;
  };
}

interface DashboardReport {
  date?: string;
  analyzedAt?: string;
  workflow?: {
    dataReadiness?: string;
    alphaReadiness?: string;
    verdict?: string;
  };
  evidence?: {
    estat?: { status?: string; hasStatsData?: boolean };
    jquants?: Record<string, unknown> & { status?: string };
  };
  decision?: {
    topSymbol?: string;
    strategy?: string;
    action?: string;
    reason?: string;
    experimentValue?: string;
  };
  results?: {
    expectedEdge?: number;
    basketDailyReturn?: number;
    status?: string;
    selectedSymbols?: string[];
  };
  risks?: {
    kellyFraction?: number;
    stopLossPct?: number;
    maxPositions?: number;
  };
  analysis?: AnalysisSymbol[];
  market?: Record<string, unknown>;
  inputs?: {
    universe?: string[];
    estatStatsDataId?: string;
  };
  options?: {
    iv?: number;
    rv?: number;
    spread?: number;
    action?: string;
  };
  commodity?: {
    macroScore?: number;
    goldCopperRatio?: number;
    oilPrice?: number;
  };
}

interface AnalysisSymbol {
  symbol: string;
  signal?: string;
  alphaScore?: number;
  finance?: {
    netSales?: number;
    profitMargin?: number;
  };
  factors?: {
    dailyReturn?: number;
    compositeSurprise?: number;
    revenueGrowth?: number;
  };
}

interface DailySummary {
  date: string;
  verdict: string;
  expectedEdge: number;
  basketDailyReturn: number;
  topSymbol: string;
}

interface BenchSummary {
  date: string;
  type: string;
  modelsCount: number;
  insight: string;
}

const STATIC_LOGS_BASE = "./logs/daily";
const UNIFIED_LOGS_BASE = "./logs/unified";
const BENCH_LOGS_BASE = "./logs/benchmarks";

interface UnifiedStage {
  stageId?: string;
  name?: string;
  category?: string;
  status?: string;
  metrics?: Record<string, number>;
  error?: string;
}

interface UnifiedRunLogPayload {
  schema?: string;
  date?: string;
  stages?: UnifiedStage[];
}

interface BenchmarkLogPayload {
  schema?: string;
  generatedAt?: string;
  models?: Array<Record<string, unknown>>;
  report?: {
    type?: string;
    benchmarkId?: string;
    date?: string;
    analyst?: {
      baselines?: Array<{ name: string; metrics: Record<string, number> }>;
      models?: Array<{ id: string; vendor: string; tags: string[] }>;
      insights?: string;
      recommendations?: string[];
    };
  };
}

const pickNumber = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const pickString = (v: unknown): string => (typeof v === "string" ? v : "");

const toSummary = (
  file: string,
  payload: Record<string, unknown>,
): DailySummary => {
  const report = (payload.report ?? payload) as Record<string, unknown>;
  const workflow = (report.workflow ?? {}) as Record<string, unknown>;
  const decision = (report.decision ?? {}) as Record<string, unknown>;
  const results = (report.results ?? {}) as Record<string, unknown>;

  return {
    date: pickString(report.date) || file.replace(".json", ""),
    verdict:
      pickString(workflow.verdict) ||
      pickString(decision.experimentValue) ||
      "UNKNOWN",
    expectedEdge: pickNumber(results.expectedEdge),
    basketDailyReturn: pickNumber(results.basketDailyReturn),
    topSymbol: pickString(decision.topSymbol) || "--",
  };
};

const toBenchSummary = (
  file: string,
  payload: BenchmarkLogPayload,
): BenchSummary => {
  const report = payload.report || {};
  return {
    date: report.date || file.replace(".json", ""),
    type: report.type || "BENCHMARK",
    modelsCount: payload.models?.length || 0,
    insight: report.analyst?.insights || "N/A",
  };
};

interface OutcomeSummary {
  id: string;
  name: string;
  date: string;
  sharpe: number;
  readiness: number;
  reasoningScore?: number;
}

const toOutcomeSummary = (payload: LogPayload): OutcomeSummary => {
  const report = payload.report as StandardOutcome;
  return {
    id: report.strategyId,
    name: report.strategyName,
    date: report.timestamp.slice(0, 10).replace(/-/g, ""),
    sharpe: report.verification?.metrics?.sharpeRatio ?? 0,
    readiness: (report.reasoningScore ?? 0) * 100,
  };
};

interface LeaderboardRow {
  id: string;
  type: "ALPHA" | "FOUNDATION" | "BASELINE";
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  dirAcc: number;
  corr: number;
  mmc: number;
  verdict: string;
}

class Dashboard {
  private logs: DailySummary[] = [];
  private benches: BenchSummary[] = [];
  private registry: Array<Record<string, unknown>> = [];
  private leaderboard: LeaderboardRow[] = [];
  private activeLog: LogPayload | null = null;
  private activeBench: BenchmarkLogPayload | null = null;
  private staticPayloadByDate = new Map<string, LogPayload>();
  private unifiedPayloadByDate = new Map<string, UnifiedRunLogPayload>();
  private benchPayloadByDate = new Map<string, BenchmarkLogPayload>();
  private outcomes: OutcomeSummary[] = [];
  private outcomePayloadById = new Map<string, LogPayload>();

  constructor() {
    this.init();
  }

  async init() {
    await Promise.all([
      this.loadStaticLogs(),
      this.loadUnifiedLogs(),
      this.loadBenchLogs(),
      this.loadRegistry(),
      this.loadOutcomeLogs(),
    ]);
    this.calculateLeaderboard();
    this.renderLeaderboard();
    const firstLog = this.logs.at(0);
    if (firstLog) {
      await this.selectLog(firstLog.date);
    }
  }

  private calculateLeaderboard() {
    // 1. Alpha Strategy (Vegetable) from Daily Logs
    const alphaReturns = this.logs
      .map((l) => l.basketDailyReturn)
      .filter((r) => r !== 0);
    const alphaMetrics = this.computeMetrics(alphaReturns);
    const alphaRow: LeaderboardRow = {
      id: "VEGETABLE_STRATEGY",
      type: "ALPHA",
      sharpe: alphaMetrics.sharpe,
      totalReturn: alphaMetrics.totalReturn,
      maxDrawdown: alphaMetrics.maxDrawdown,
      dirAcc: 0,
      corr: 0,
      mmc: 0,
      verdict: alphaMetrics.sharpe > 1.0 ? "READY" : "CAUTION",
    };

    // 2. Foundation Models from latest Benchmark
    const benchRows: LeaderboardRow[] = [];
    const latestBench = Array.from(this.benchPayloadByDate.values()).sort(
      (a, b) => (b.report?.date || "").localeCompare(a.report?.date || ""),
    )[0];

    if (latestBench?.report?.analyst?.baselines) {
      for (const b of latestBench.report.analyst.baselines) {
        const metrics = b.metrics || {};
        benchRows.push({
          id: b.name,
          type: b.name.includes("Naive") ? "BASELINE" : "FOUNDATION",
          sharpe: pickNumber(metrics.sharpeRatio),
          totalReturn: 0,
          maxDrawdown: 0,
          dirAcc: pickNumber(metrics.directionalAccuracy),
          corr: 0,
          mmc: 0,
          verdict:
            pickNumber(metrics.directionalAccuracy) > 50 ? "READY" : "FAIL",
        });
      }
    }

    // 3. Standardized Outcomes
    const outcomeRows: LeaderboardRow[] = this.outcomes.map((o) => {
      const payload = this.outcomePayloadById.get(o.id);
      const alpha = (payload?.report as StandardOutcome)?.alpha;
      return {
        id: o.name,
        type: "ALPHA",
        sharpe: o.sharpe,
        totalReturn: 0,
        maxDrawdown: 0,
        dirAcc: 0,
        corr: alpha?.numerai?.corr ?? 0,
        mmc: alpha?.numerai?.mmc ?? 0,
        verdict: (o.reasoningScore ?? 0) >= 0.75 ? "READY" : "CAUTION",
      };
    });

    this.leaderboard = [alphaRow, ...benchRows, ...outcomeRows].sort(
      (a, b) => b.sharpe - a.sharpe,
    );
  }

  private computeMetrics(returns: number[]) {
    if (returns.length === 0)
      return { sharpe: 0, totalReturn: 0, maxDrawdown: 0 };
    const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const vol = Math.sqrt(
      returns.reduce((a, b) => a + (b - avg) ** 2, 0) / returns.length,
    );
    const annReturn = (1 + avg) ** 252 - 1;
    const annVol = vol * Math.sqrt(252);
    const sharpe = annVol > 0 ? annReturn / annVol : 0;

    let peak = 1;
    let maxDd = 0;
    let equity = 1;
    for (const r of returns) {
      equity *= 1 + r;
      peak = Math.max(peak, equity);
      maxDd = Math.min(maxDd, (equity - peak) / peak);
    }
    return { sharpe, totalReturn, maxDrawdown: maxDd };
  }

  private renderLeaderboard() {
    const el = document.getElementById("leaderboard-table");
    if (!el) return;

    if (this.leaderboard.length === 0) {
      el.innerHTML =
        '<div class="log-sub">比較可能なデータがありません。</div>';
      return;
    }

    el.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Model / Strategy</th>
            <th>Type</th>
            <th>Sharpe</th>
            <th>Return</th>
            <th>CORR</th>
            <th>MMC</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          ${this.leaderboard
        .map(
          (row) => `
            <tr>
              <td><strong>${this.escapeHtml(row.id)}</strong></td>
              <td><span class="badge badge-neutral">${row.type}</span></td>
              <td class="${row.sharpe > 1.5 ? "pos" : ""}"><strong>${row.sharpe.toFixed(2)}</strong></td>
              <td class="${row.totalReturn >= 0 ? "pos" : "neg"}">${(row.totalReturn * 100).toFixed(1)}%</td>
              <td class="pos">${row.corr > 0 ? row.corr.toFixed(3) : "--"}</td>
              <td class="pos">${row.mmc > 0 ? row.mmc.toFixed(3) : "--"}</td>
              <td><span class="badge ${row.verdict === "READY" ? "badge-success" : row.verdict === "CAUTION" ? "badge-warning" : "badge-danger"}">${row.verdict}</span></td>
            </tr>
          `,
        )
        .join("")}
        </tbody>
      </table>
    `;
  }

  private async loadRegistry() {
    try {
      const res = await fetch("./registry/models.json");
      if (!res.ok) return;
      const data = await res.json();
      this.registry = Array.isArray(data) ? data : data.models || [];
      this.renderRegistry();
    } catch (_e) {
      // Ignore
    }
  }

  private renderRegistry() {
    const list = document.getElementById("registry-list");
    if (!list) return;
    list.innerHTML = this.registry
      .map(
        (m) => `
      <div class="log-item" style="cursor: default;">
        <div class="log-item-row">
          <span class="log-date">${this.escapeHtml(m.name || m.id)}</span>
          <span class="badge badge-neutral">${this.escapeHtml(m.vendor || "N/A")}</span>
        </div>
        <div class="log-sub">${this.escapeHtml(m.id)}</div>
      </div>
    `,
      )
      .join("");
  }

  private async loadStaticLogs() {
    try {
      const manifestRes = await fetch(`${STATIC_LOGS_BASE}/manifest.json`);
      if (!manifestRes.ok) return;

      const files = (await manifestRes.json()) as string[];
      const jsonFiles = files
        .filter((f) => /^\d{8}\.json$/.test(f))
        .sort()
        .reverse();

      const settled = await Promise.allSettled(
        jsonFiles.map(async (file) => {
          const res = await fetch(`${STATIC_LOGS_BASE}/${file}`);
          if (!res.ok)
            throw new Error(`Failed to fetch ${file}: ${res.status}`);
          const payload = (await res.json()) as LogPayload;
          const report = payload.report as Record<string, unknown>;
          const date = (report?.date as string) || file.replace(".json", "");
          this.staticPayloadByDate.set(date, payload);
          return toSummary(file, payload as unknown as Record<string, unknown>);
        }),
      );

      this.logs = settled
        .filter(
          (r): r is PromiseFulfilledResult<DailySummary> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      this.renderSidebar();
    } catch (_e) {
      // Ignore
    }
  }

  private async loadUnifiedLogs() {
    try {
      const manifestRes = await fetch(`${UNIFIED_LOGS_BASE}/manifest.json`);
      if (!manifestRes.ok) return;
      const files = (await manifestRes.json()) as string[];
      const jsonFiles = files
        .filter((f) => /^\d{8}\.json$/.test(f))
        .sort()
        .reverse();
      const settled = await Promise.allSettled(
        jsonFiles.map(async (file) => {
          const res = await fetch(`${UNIFIED_LOGS_BASE}/${file}`);
          if (!res.ok)
            throw new Error(`Failed to fetch ${file}: ${res.status}`);
          return (await res.json()) as UnifiedRunLogPayload;
        }),
      );
      settled.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const payload = r.value;
        const date = payload.date || "";
        if (date) this.unifiedPayloadByDate.set(date, payload);
      });
    } catch (_e) {
      // Unified logs are optional for local preview.
    }
  }

  private async loadOutcomeLogs() {
    try {
      const manifestRes = await fetch(`${UNIFIED_LOGS_BASE}/manifest.json`);
      if (!manifestRes.ok) return;
      const files = (await manifestRes.json()) as string[];
      const settled = await Promise.allSettled(
        files.map(async (file) => {
          const res = await fetch(`${UNIFIED_LOGS_BASE}/${file}`);
          if (!res.ok) return null;
          const payload = (await res.json()) as LogPayload;
          if (payload.schema !== "investor.investment-outcome") return null;
          return payload;
        }),
      );

      this.outcomes = settled
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r) => toOutcomeSummary((r as { value: LogPayload }).value));

      settled.forEach((r) => {
        if (r.status === "fulfilled" && r.value !== null) {
          const p = r.value as LogPayload;
          const report = p.report as StandardOutcome;
          this.outcomePayloadById.set(report.strategyId, p);
        }
      });

      this.renderSidebar();
    } catch (_e) {
      // Ignore
    }
  }

  private async loadBenchLogs() {
    try {
      const manifestRes = await fetch(`${BENCH_LOGS_BASE}/manifest.json`);
      if (!manifestRes.ok) return;

      const files = (await manifestRes.json()) as string[];
      const jsonFiles = files
        .filter((f) => /^\d{8}\.json$/.test(f))
        .sort()
        .reverse();

      const settled = await Promise.allSettled(
        jsonFiles.map(async (file) => {
          const res = await fetch(`${BENCH_LOGS_BASE}/${file}`);
          if (!res.ok)
            throw new Error(`Failed to fetch ${file}: ${res.status}`);
          const payload = (await res.json()) as BenchmarkLogPayload;
          const date = payload.report?.date || file.replace(".json", "");
          this.benchPayloadByDate.set(date, payload);
          return toBenchSummary(file, payload);
        }),
      );

      this.benches = settled
        .filter(
          (r): r is PromiseFulfilledResult<BenchSummary> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      this.renderSidebar();
    } catch (_e) {
      // Ignore
    }
  }

  private async selectLog(date: string) {
    const payload = this.staticPayloadByDate.get(date);
    if (!payload) return;
    this.activeLog = payload;
    this.activeBench = null;
    this.renderActiveLog();

    document.querySelectorAll(".log-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-date") === date);
    });
  }

  private async selectBench(date: string) {
    const payload = this.benchPayloadByDate.get(date);
    if (!payload) return;
    this.activeBench = payload;
    this.activeLog = null;
    this.renderActiveBench();

    document.querySelectorAll(".log-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-date") === date);
    });
  }

  private async selectOutcome(id: string) {
    const payload = this.outcomePayloadById.get(id);
    if (!payload) return;
    this.activeLog = payload;
    this.activeBench = null;
    this.renderActiveOutcome();

    document.querySelectorAll(".log-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-id") === id);
    });
  }

  private renderSidebar() {
    const dailyList = document.getElementById("log-list");
    if (dailyList) {
      dailyList.innerHTML = this.logs
        .map(
          (log) => `
        <div class="log-item ${(this.activeLog?.report as Record<string, unknown>)?.date === log.date ? "active" : ""}"
             data-date="${this.escapeHtml(log.date)}">
          <div class="log-item-row">
            <span class="log-date">${this.escapeHtml(this.formatDate(log.date))}</span>
            <span class="badge ${log.verdict === "USEFUL" ? "badge-success" : "badge-danger"}">${this.escapeHtml(log.verdict)}</span>
          </div>
          <div class="log-sub">
            日次収益 ${(log.basketDailyReturn * 100).toFixed(2)}% / 期待エッジ ${(log.expectedEdge * 100).toFixed(2)}%
          </div>
        </div>
      `,
        )
        .join("");

      dailyList.querySelectorAll(".log-item").forEach((el) => {
        el.addEventListener("click", () => {
          const date = el.getAttribute("data-date");
          if (date) this.selectLog(date);
        });
      });
    }

    const benchList = document.getElementById("bench-list");
    if (benchList) {
      benchList.innerHTML = this.benches
        .map(
          (bench) => `
        <div class="log-item ${this.activeBench?.report?.date === bench.date ? "active" : ""}"
             data-date="${this.escapeHtml(bench.date)}">
          <div class="log-item-row">
            <span class="log-date">${this.escapeHtml(this.formatDate(bench.date))}</span>
            <span class="badge badge-neutral">${this.escapeHtml(bench.type)}</span>
          </div>
          <div class="log-sub">
            モデル数: ${bench.modelsCount} / ${this.escapeHtml(bench.insight.slice(0, 20))}...
          </div>
        </div>
      `,
        )
        .join("");

      benchList.querySelectorAll(".log-item").forEach((el) => {
        el.addEventListener("click", () => {
          const date = el.getAttribute("data-date");
          if (date) this.selectBench(date);
        });
      });
    }

    const outcomeList = document.getElementById("outcome-list");
    if (outcomeList) {
      outcomeList.innerHTML = this.outcomes
        .map(
          (o) => {
            const readiness = (o.reasoningScore ?? 0) * 100;
            return `
              <div class="log-item" data-id="${this.escapeHtml(o.id)}">
                <div class="log-item-row">
                  <span class="log-date">${this.escapeHtml(o.name)}</span>
                  <span class="badge ${readiness >= 75 ? "badge-success" : "badge-warning"}">Score: ${readiness.toFixed(0)}</span>
                </div>
                <div class="log-sub">Sharpe: ${o.sharpe.toFixed(2)} / Date: ${o.date}</div>
              </div>
            `;
          },
        )
        .join("");

      outcomeList.querySelectorAll(".log-item").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.getAttribute("data-id");
          if (id) this.selectOutcome(id);
        });
      });
    }
  }

  private renderActiveLog() {
    if (!this.activeLog) return;
    if (this.activeLog.schema === "investor.investment-outcome") {
      this.renderActiveOutcome();
      return;
    }
    const report = this.activeLog.report as DashboardReport;
    // ... (rest of renderActiveLog remains similar)

    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      const ts = this.activeLog.generatedAt || report.analyzedAt;
      updateEl.textContent = ts
        ? `更新: ${new Date(ts).toLocaleString("ja-JP")}`
        : "更新: --";
    }

    this.updateText(
      "stat-edge",
      `${(pickNumber(report.results?.expectedEdge) * 100).toFixed(2)}%`,
    );
    this.updateText(
      "stat-return",
      `${(pickNumber(report.results?.basketDailyReturn) * 100).toFixed(2)}%`,
      pickNumber(report.results?.basketDailyReturn) >= 0
        ? "var(--success)"
        : "var(--danger)",
    );
    this.updateText(
      "stat-kelly",
      `${(pickNumber(report.risks?.kellyFraction) * 100).toFixed(2)}%`,
    );
    this.updateText("stat-top", pickString(report.decision?.topSymbol) || "--");

    const workflowEl = document.getElementById("workflow-status");
    if (workflowEl) {
      workflowEl.innerHTML = `
        ${this.statusRow("データ準備", pickString(report.workflow?.dataReadiness))}
        ${this.statusRow("アルファ判定", pickString(report.workflow?.alphaReadiness))}
        ${this.statusRow("e-Stat", pickString(report.evidence?.estat?.status))}
        ${this.statusRow("J-Quants", pickString(report.evidence?.jquants?.status))}
      `;
    }

    const analysisEl = document.getElementById("symbol-analysis");
    if (analysisEl && Array.isArray(report.analysis)) {
      analysisEl.innerHTML = report.analysis
        .map(
          (s: AnalysisSymbol) => `
        <div class="symbol-card animate-fade">
          <div class="symbol-head">
            <span class="symbol-code">${this.escapeHtml(s.symbol)}</span>
            <span class="badge ${s.signal === "LONG" ? "badge-success" : "badge-neutral"}">${this.escapeHtml(s.signal || "N/A")}</span>
          </div>
          <div class="symbol-metrics">
            <div><div class="metric-label">Alpha Score</div><div class="metric-value">${pickNumber(s.alphaScore).toFixed(4)}</div></div>
            <div><div class="metric-label">複合サプライズ</div><div class="metric-value ${pickNumber(s.factors?.compositeSurprise) >= 0 ? "pos" : "neg"}">${(pickNumber(s.factors?.compositeSurprise) * 100).toFixed(1)}%</div></div>
            <div><div class="metric-label">売上成長率</div><div class="metric-value ${pickNumber(s.factors?.revenueGrowth) >= 0 ? "pos" : "neg"}">${(pickNumber(s.factors?.revenueGrowth) * 100).toFixed(1)}%</div></div>
            <div><div class="metric-label">利益率</div><div class="metric-value">${(pickNumber(s.finance?.profitMargin) * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      `,
        )
        .join("");

      // Strategy Y & Macro Section Injection
      if (report.options || report.commodity) {
        analysisEl.innerHTML += `
          <div class="symbol-card animate-fade" style="grid-column: 1 / -1; border-top: 2px solid var(--border); padding-top: 15px; margin-top: 10px;">
            <div class="stat-group" style="grid-template-columns: 1fr 1fr;">
              <!-- Option Section -->
              ${report.options
            ? `
              <div>
                <div class="box-title" style="color: #c084fc;">Option Strategy Y (VRP)</div>
                <div class="symbol-metrics">
                  <div><div class="metric-label">IV / RV</div><div class="metric-value">${(pickNumber(report.options.iv) * 100).toFixed(1)}% / ${(pickNumber(report.options.rv) * 100).toFixed(1)}%</div></div>
                  <div><div class="metric-label">VRP Spread</div><div class="metric-value pos">${pickNumber(report.options.spread).toFixed(2)}%</div></div>
                  <div><div class="metric-label">Action</div><div class="badge badge-success">${this.escapeHtml(report.options.action)}</div></div>
                </div>
              </div>`
            : ""
          }
              
              <!-- Commodity Section -->
              ${report.commodity
            ? `
              <div>
                <div class="box-title" style="color: #fbbf24;">Commodity Macro Model</div>
                <div class="symbol-metrics">
                  <div><div class="metric-label">Macro Score</div><div class="metric-value ${pickNumber(report.commodity.macroScore) > 0 ? "pos" : "neg"}">${pickNumber(report.commodity.macroScore).toFixed(2)}</div></div>
                  <div><div class="metric-label">Gold/Copper</div><div class="metric-value">${pickNumber(report.commodity.goldCopperRatio).toFixed(2)}</div></div>
                  <div><div class="metric-label">Oil (Brent)</div><div class="metric-value">$${pickNumber(report.commodity.oilPrice)}</div></div>
                </div>
              </div>`
            : ""
          }
            </div>
          </div>
        `;
      }
    }

    const verdictEl = document.getElementById("verdict-content");
    if (verdictEl) {
      verdictEl.innerHTML = `
        <div class="box-title">戦略</div>
        <div>${this.escapeHtml(report.decision?.strategy || "N/A")}</div>
        <div class="box-title">アクション</div>
        <div>${this.escapeHtml(report.decision?.action || "N/A")}</div>
        <div class="box-title">理由</div>
        <div>${this.escapeHtml(report.decision?.reason || "N/A")}</div>
      `;
    }

    const jsonEl = document.getElementById("json-content");
    if (jsonEl) {
      jsonEl.innerHTML = `<pre>${this.escapeHtml(
        JSON.stringify(this.activeLog, null, 2),
      )}</pre>`;
    }

    this.renderValidationPanel(pickString(report.date));
  }

  private renderActiveBench() {
    if (!this.activeBench) return;
    const report = this.activeBench.report || {};
    const analyst = report.analyst || {};

    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      updateEl.textContent = this.activeBench.generatedAt
        ? `更新: ${new Date(this.activeBench.generatedAt).toLocaleString("ja-JP")}`
        : "更新: --";
    }

    // Benchmark-specific summary stats
    this.updateText("stat-edge", "BMK");
    this.updateText("stat-return", report.type || "BENCHMARK");
    this.updateText("stat-kelly", report.date || "--");
    this.updateText("stat-top", report.benchmarkId || "--");

    const workflowEl = document.getElementById("workflow-status");
    if (workflowEl) {
      workflowEl.innerHTML = `
        ${this.statusRow("ベンチマーク", "PASS")}
        ${this.statusRow("モデル数", (this.activeBench.models?.length || 0).toString())}
        ${this.statusRow("ベースライン", (analyst.baselines?.length || 0).toString())}
      `;
    }

    const analysisEl = document.getElementById("symbol-analysis");
    if (analysisEl) {
      const modelCards = (analyst.models || [])
        .map(
          (m) => `
        <div class="symbol-card animate-fade">
          <div class="symbol-head">
            <span class="symbol-code">${this.escapeHtml(m.id)}</span>
            <span class="badge badge-neutral">${this.escapeHtml(m.vendor)}</span>
          </div>
          <div class="log-sub">${(m.tags || []).join(", ")}</div>
        </div>
      `,
        )
        .join("");

      const baselineCards = (analyst.baselines || [])
        .map((b) => {
          const da = pickNumber(b.metrics.directionalAccuracy);
          const daDisplay = da.toFixed(1);
          return `
        <div class="symbol-card animate-fade" style="border-left: 4px solid var(--accent);">
          <div class="symbol-head">
            <span class="symbol-code">${this.escapeHtml(b.name)}</span>
            <span class="badge badge-success">BASELINE</span>
          </div>
          <div class="symbol-metrics">
            <div><div class="metric-label">MAE</div><div class="metric-value">${pickNumber(b.metrics.mae).toFixed(2)}</div></div>
            <div><div class="metric-label">RMSE</div><div class="metric-value">${pickNumber(b.metrics.rmse).toFixed(2)}</div></div>
            <div><div class="metric-label">DirAcc</div><div class="metric-value">${daDisplay}%</div></div>
          </div>
        </div>
      `;
        })
        .join("");

      analysisEl.innerHTML = baselineCards + modelCards;
    }

    const verdictEl = document.getElementById("verdict-content");
    if (verdictEl) {
      verdictEl.innerHTML = `
        <div class="box-title">インサイト</div>
        <div style="font-size: 0.9em; line-height: 1.4;">${this.escapeHtml(analyst.insights || "N/A")}</div>
        <div class="box-title">推奨事項</div>
        <ul style="padding-left: 1.2em; margin: 0.5em 0;">
          ${(analyst.recommendations || []).map((r: string) => `<li>${this.escapeHtml(r)}</li>`).join("")}
        </ul>
      `;
    }

    const validationEl = document.getElementById("validation-results");
    if (validationEl) {
      validationEl.innerHTML = `<div class="metric-label">ベンチマーク詳細（JSON参照）</div>`;
    }

    const jsonEl = document.getElementById("json-content");
    if (jsonEl) {
      jsonEl.innerHTML = `<pre>${this.escapeHtml(
        JSON.stringify(this.activeBench, null, 2),
      )}</pre>`;
    }
  }

  private renderValidationPanel(date: string) {
    const container = document.getElementById("validation-results");
    if (!container) return;
    const runLog = this.unifiedPayloadByDate.get(date);
    if (
      !runLog ||
      !Array.isArray(runLog.stages) ||
      runLog.stages.length === 0
    ) {
      container.innerHTML = `<div class="metric-label">統一ログがありません（${this.escapeHtml(date || "--")}）</div>`;
      return;
    }

    container.innerHTML = runLog.stages
      .map((stage) => {
        const status = pickString(stage.status);
        const badge = status === "PASS" ? "badge-success" : "badge-danger";
        const metrics = Object.entries(stage.metrics ?? {})
          .slice(0, 4)
          .map(([k, v]) => `${this.escapeHtml(k)}: ${pickNumber(v).toFixed(4)}`)
          .join(" / ");
        const error = stage.error
          ? `<div class="log-sub neg">error: ${this.escapeHtml(stage.error)}</div>`
          : "";
        return `
          <div class="symbol-card animate-fade">
            <div class="symbol-head">
              <span class="symbol-code">${this.escapeHtml(stage.name || "N/A")}</span>
              <span class="badge ${badge}">${this.escapeHtml(status || "N/A")}</span>
            </div>
            <div class="log-sub">${this.escapeHtml(stage.category || "unknown")} / ${this.escapeHtml(stage.stageId || "--")}</div>
            <div class="log-sub">${metrics || "metrics: --"}</div>
            ${error}
          </div>
        `;
      })
      .join("");
  }

  private statusRow(label: string, status: string) {
    const kind = status === "PASS" ? "badge-success" : "badge-danger";
    return `<div class="status-row"><span>${this.escapeHtml(label)}</span><span class="badge ${kind}">${this.escapeHtml(status || "--")}</span></div>`;
  }

  private formatDate(dateStr: string) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  private updateText(id: string, text: string, color?: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  private renderActiveOutcome() {
    if (
      !this.activeLog ||
      this.activeLog.schema !== "investor.investment-outcome"
    )
      return;
    const report = this.activeLog.report as StandardOutcome;

    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      updateEl.textContent = `生成: ${new Date(report.timestamp).toLocaleString("ja-JP")}`;
    }

    this.updateText("stat-edge", "Outcome");
    this.updateText("stat-return", "Tiers 1-4");
    this.updateText(
      "stat-kelly",
      report.verification?.metrics?.sharpeRatio?.toFixed(2) ?? "--",
    );
    this.updateText("stat-top", report.strategyId);

    const workflowEl = document.getElementById("workflow-status");
    if (workflowEl) {
      const readiness = (report.reasoningScore ?? 0) * 100;
      workflowEl.innerHTML = `
        ${this.statusRow("Readiness Score", readiness.toFixed(0))}
        ${this.statusRow("Production Ready", report.stability?.isProductionReady ? "YES" : "NO")}
        ${this.statusRow("Information Coeff", report.alpha?.informationCoefficient?.toFixed(3) || "--")}
      `;
    }

    const analysisEl = document.getElementById("symbol-analysis");
    if (analysisEl) {
      analysisEl.innerHTML = `
        <div class="symbol-card animate-fade" style="grid-column: 1 / -1; border-left: 4px solid var(--accent);">
          <div class="symbol-head">
            <span class="symbol-code">${this.escapeHtml(report.strategyName)}</span>
            <span class="badge badge-success">ARXIV STANDARDIZED OUTCOME</span>
          </div>
          <p style="margin: 10px 0; line-height: 1.5; color: var(--text-secondary);">${this.escapeHtml(report.summary)}</p>
          ${report.reasoning
          ? `
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border-left: 2px solid var(--accent); margin-top: 10px;">
            <div style="font-size: 0.75em; opacity: 0.6; margin-bottom: 4px;">PRINCIPLES & VERDICT (DALIO STYLE)</div>
            <div style="font-style: italic; color: var(--text-primary); font-size: 0.9em;">"${this.escapeHtml(report.reasoning)}"</div>
          </div>
          `
          : ""
        }
        </div>

        <!-- Tier 1: Alpha Significance -->
        <div class="symbol-card animate-fade">
          <div class="box-title">Tier 1: Alpha Significance</div>
          <div class="symbol-metrics">
            <div><div class="metric-label">t-Stat</div><div class="metric-value">${report.alpha?.tStat?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">p-Value</div><div class="metric-value ${report.alpha?.pValue && report.alpha.pValue < 0.05 ? "pos" : "neg"}">${report.alpha?.pValue?.toFixed(4) || "--"}</div></div>
            <div><div class="metric-label">IC</div><div class="metric-value">${report.alpha?.informationCoefficient?.toFixed(3) || "--"}</div></div>
            <div><div class="metric-label">CORR</div><div class="metric-value">${report.alpha?.numerai?.corr?.toFixed(4) || "--"}</div></div>
            <div><div class="metric-label">MMC</div><div class="metric-value">${report.alpha?.numerai?.mmc?.toFixed(4) || "--"}</div></div>
            <div><div class="metric-label">FNC</div><div class="metric-value">${report.alpha?.numerai?.fnc?.toFixed(4) || "--"}</div></div>
          </div>
          <div class="box-title" style="margin-top: 10px; font-size: 0.8em; opacity: 0.7;">Fama-French Five-Factors</div>
          <div class="symbol-metrics" style="grid-template-columns: repeat(5, 1fr);">
            <div><div class="metric-label">MKT</div><div class="metric-value">${report.alpha?.famaFrench?.mkt?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">SMB</div><div class="metric-value">${report.alpha?.famaFrench?.smb?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">HML</div><div class="metric-value">${report.alpha?.famaFrench?.hml?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">RMW</div><div class="metric-value">${report.alpha?.famaFrench?.rmw?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">CMA</div><div class="metric-value">${report.alpha?.famaFrench?.cma?.toFixed(2) || "--"}</div></div>
          </div>
        </div>

        <!-- Tier 2: Verification -->
        <div class="symbol-card animate-fade">
          <div class="box-title">Tier 2: Verification</div>
          <div class="symbol-metrics">
            <div><div class="metric-label">Sharpe</div><div class="metric-value pos">${report.verification?.metrics?.sharpeRatio?.toFixed(2) || "--"}</div></div>
            <div><div class="metric-label">Ann. Return</div><div class="metric-value">${((report.verification?.metrics?.annualizedReturn ?? 0) * 100).toFixed(1)}%</div></div>
            <div><div class="metric-label">MaxDD</div><div class="metric-value neg">${((report.verification?.metrics?.maxDrawdown ?? 0) * 100).toFixed(1)}%</div></div>
            <div><div class="metric-label">Uplift</div><div class="metric-value">${((report.verification?.upliftOverBaseline ?? 0) * 100).toFixed(1)}%</div></div>
          </div>
        </div>

        <!-- Tier 3: Operational Stability -->
        <div class="symbol-card animate-fade">
          <div class="box-title">Tier 3: Stability</div>
          <div class="symbol-metrics">
            <div><div class="metric-label">Tracking Err</div><div class="metric-value pos">${report.stability?.trackingError?.toFixed(4) || "--"}</div></div>
            <div><div class="metric-label">Horizon</div><div class="metric-value">${report.stability?.tradingDaysHorizon || "--"} days</div></div>
          </div>
        </div>

        <!-- Tier 4: Execution Audit -->
        <div class="symbol-card animate-fade">
          <div class="box-title">Tier 4: Execution</div>
          <div class="symbol-metrics">
            <div><div class="metric-label">Total PnL</div><div class="metric-value">¥${((report.execution?.totalPnL ?? 0) / 10000).toFixed(0)}万</div></div>
            <div><div class="metric-label">Tracking Error</div><div class="metric-value">${((report.execution?.trackingError ?? 0) * 100).toFixed(2)}%</div></div>
            <div><div class="metric-label">Slippage Impact</div><div class="metric-value">${report.execution?.slippageImpactBps?.toFixed(1) || "--"} bps</div></div>
          </div>
        </div>
      `;
    }

    const jsonEl = document.getElementById("json-content");
    if (jsonEl) {
      jsonEl.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(this.activeLog, null, 2))}</pre>`;
    }
  }

  private escapeHtml(value: unknown): string {
    const str = String(value ?? "");
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
}

new Dashboard();
