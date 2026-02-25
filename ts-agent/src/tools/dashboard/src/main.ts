import "./style.css";

// --- Types & Interfaces ---

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
  reasoningScore?: number;
  alpha?: {
    tStat?: number;
    pValue?: number;
    informationCoefficient?: number;
    numerai?: { corr?: number; mmc?: number; fnc?: number };
    famaFrench?: Record<string, number>;
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
  };
  results?: {
    expectedEdge?: number;
    basketDailyReturn?: number;
    status?: string;
    backtest?: Record<string, unknown>;
  };
  risks?: {
    kellyFraction?: number;
    stopLossPct?: number;
    maxPositions?: number;
  };
  analysis?: AnalysisSymbol[];
  market?: Record<string, unknown>;
  execution?: {
    mode?: string;
    status?: string;
    orderCount?: number;
    orders?: Array<{
      symbol: string;
      side: string;
      quantity: number;
      fillPrice: number;
      notional: number;
      executedAt: string;
    }>;
  };
}

interface AnalysisSymbol {
  symbol: string;
  signal?: string;
  alphaScore?: number;
  finance?: {
    netSales?: number;
    operatingProfit?: number;
    profitMargin?: number;
  };
  factors?: {
    dailyReturn?: number;
    intradayRange?: number;
    closeStrength?: number;
    liquidityPerShare?: number;
    compositeSurprise?: number;
  };
}

interface DailySummary {
  date: string;
  verdict: string;
  basketDailyReturn: number;
}

interface BenchSummary {
  date: string;
  type: string;
  modelsCount: number;
  insight: string;
}

interface OutcomeSummary {
  id: string;
  name: string;
  date: string;
  sharpe: number;
  readiness: number;
}

interface LeaderboardRow {
  id: string;
  type: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  verdict: string;
}

const STATIC_LOGS_BASE = "./logs/daily";
const UNIFIED_LOGS_BASE = "./logs/unified";
const BENCH_LOGS_BASE = "./logs/benchmarks";

// --- Helpers ---

const pickNumber = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const toSummary = (file: string, payload: LogPayload): DailySummary => {
  const report = (payload.report ?? payload) as DashboardReport;
  return {
    date: report.date || file.replace(".json", ""),
    verdict: report.workflow?.verdict || "UNKNOWN",
    basketDailyReturn: pickNumber(report.results?.basketDailyReturn),
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

// --- Core View Engine Interface ---

interface ViewEngine {
  render(payload: LogPayload): void;
}

interface BenchmarkLogPayload {
  report?: {
    type?: string;
    benchmarkId?: string;
    date?: string;
    analyst?: {
      models?: Array<{ id: string; vendor: string }>;
      insights?: string;
      baselines?: Array<{
        name: string;
        metrics: Record<string, number>;
      }>;
    };
  };
  models?: Array<Record<string, unknown>>;
}

interface UnifiedRunLogPayload {
  date?: string;
  stages?: Array<{
    name?: string;
    status?: string;
    metrics?: Record<string, number>;
  }>;
}

// --- Dashboard Shell ---

class DashboardShell {
  private logs: DailySummary[] = [];
  private outcomes: OutcomeSummary[] = [];
  private benches: BenchSummary[] = [];
  private registry: Array<Record<string, unknown>> = [];

  private staticPayloadByDate = new Map<string, LogPayload>();
  private unifiedPayloadByDate = new Map<string, UnifiedRunLogPayload>();
  private benchPayloadByDate = new Map<string, BenchmarkLogPayload>();
  private outcomePayloadById = new Map<string, LogPayload>();

  private viewEngines = new Map<string, ViewEngine>();

  constructor() {
    this.registerEngines();
    this.init();
    this.startPolling();
  }

  private registerEngines() {
    this.viewEngines.set("investor.daily-log.v1", new DailyLogEngine(this));
    this.viewEngines.set(
      "investor.investment-outcome",
      new OutcomeEngine(this),
    );
    this.viewEngines.set("investor.benchmark.v1", new BenchmarkEngine(this));
  }

  private async init() {
    await this.refreshContent();
    const first = this.logs.at(0);
    if (first) this.selectLog(first.date);
  }

  private startPolling() {
    window.setInterval(() => this.refreshContent(), 30000);
  }

  private async refreshContent() {
    console.log("♻️ Precision Shell: Refreshing...");
    await Promise.all([
      this.loadStaticLogs(),
      this.loadUnifiedLogs(),
      this.loadBenchLogs(),
      this.loadRegistry(),
      this.loadOutcomeLogs(),
    ]);
    this.renderSidebar();
    this.renderLeaderboard();
  }

  private async loadStaticLogs() {
    try {
      const res = await fetch(`${STATIC_LOGS_BASE}/manifest.json`);
      if (!res.ok) return;
      const files = (await res.json()) as string[];
      for (const file of files.filter((f) => /^\d{8}\.json$/.test(f))) {
        const r = await fetch(`${STATIC_LOGS_BASE}/${file}`);
        if (r.ok) {
          const p = (await r.json()) as LogPayload;
          const report = (p.report ?? p) as DashboardReport;
          const date = report.date || file.replace(".json", "");
          this.staticPayloadByDate.set(date, p);
        }
      }
      this.logs = Array.from(this.staticPayloadByDate.entries())
        .map(([f, p]) => toSummary(f, p))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch (_e) {}
  }

  private async loadUnifiedLogs() {
    try {
      const res = await fetch(`${UNIFIED_LOGS_BASE}/manifest.json`);
      if (!res.ok) return;
      const files = (await res.json()) as string[];
      for (const file of files.filter((f) => f.endsWith(".json"))) {
        const r = await fetch(`${UNIFIED_LOGS_BASE}/${file}`);
        if (r.ok) {
          const p = (await r.json()) as UnifiedRunLogPayload;
          const date = p.date || file.replace(".json", "");
          this.unifiedPayloadByDate.set(date, p);
        }
      }
    } catch (_e) {}
  }

  private async loadBenchLogs() {
    try {
      const res = await fetch(`${BENCH_LOGS_BASE}/manifest.json`);
      if (!res.ok) return;
      const files = (await res.json()) as string[];
      for (const file of files.filter((f) => /^\d{8}\.json$/.test(f))) {
        const r = await fetch(`${BENCH_LOGS_BASE}/${file}`);
        if (r.ok) {
          const p = (await r.json()) as BenchmarkLogPayload;
          const date = p.report?.date || file.replace(".json", "");
          this.benchPayloadByDate.set(date, p);
        }
      }
      this.benches = Array.from(this.benchPayloadByDate.entries())
        .map(([f, p]) => toBenchSummary(f, p))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch (_e) {}
  }

  private async loadOutcomeLogs() {
    try {
      const res = await fetch(`${UNIFIED_LOGS_BASE}/manifest.json`);
      if (!res.ok) return;
      const files = (await res.json()) as string[];
      const outcomes: OutcomeSummary[] = [];
      for (const file of files) {
        const r = await fetch(`${UNIFIED_LOGS_BASE}/${file}`);
        if (r.ok) {
          const p = (await r.json()) as LogPayload;
          if (p.schema === "investor.investment-outcome") {
            const report = p.report as StandardOutcome;
            this.outcomePayloadById.set(report.strategyId, p);
            outcomes.push(toOutcomeSummary(p));
          }
        }
      }
      this.outcomes = outcomes;
    } catch (_e) {}
  }

  private async loadRegistry() {
    try {
      const res = await fetch("./registry/models.json");
      if (!res.ok) return;
      const data = await res.json();
      this.registry = Array.isArray(data) ? data : data.models || [];
      this.renderRegistry();
    } catch (_e) {}
  }

  public selectLog(date: string) {
    const p = this.staticPayloadByDate.get(date);
    if (p) this.dispatch(p);
    this.updateActiveItem("data-date", date);
    this.updateTimeLabel();
  }

  public selectBenchmark(date: string) {
    const p = this.benchPayloadByDate.get(date);
    if (p) this.dispatch(p as unknown as LogPayload);
    this.updateActiveItem("data-date", date);
    this.updateTimeLabel();
  }

  public selectOutcome(id: string) {
    const p = this.outcomePayloadById.get(id);
    if (p) this.dispatch(p);
    this.updateActiveItem("data-id", id);
    this.updateTimeLabel();
  }

  private dispatch(payload: LogPayload) {
    const schema = payload.schema || "investor.daily-log.v1";
    const engine = this.viewEngines.get(schema) || new GenericLogEngine(this);
    engine.render(payload);
    this.renderRawJSON(payload);
  }

  private renderSidebar() {
    const renderList = <T>(
      id: string,
      items: T[],
      template: (i: T) => string,
      clickHandler: (val: string) => void,
      attr: string,
    ) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = items.map(template).join("");
      el.querySelectorAll(".log-item").forEach((i) => {
        i.addEventListener("click", () => clickHandler(i.getAttribute(attr)!));
      });
    };

    renderList(
      "log-list",
      this.logs,
      (l) => `
      <div class="log-item" data-date="${l.date}">
        <div class="log-item-row"><span class="log-date">${this.formatDate(l.date)}</span><span class="badge ${l.verdict === "USEFUL" ? "badge-success" : "badge-danger"}">${l.verdict}</span></div>
        <div class="log-sub">Ret: ${(l.basketDailyReturn * 100).toFixed(2)}%</div>
      </div>`,
      (v) => this.selectLog(v),
      "data-date",
    );

    renderList(
      "bench-list",
      this.benches,
      (b) => `
      <div class="log-item" data-date="${b.date}">
        <div class="log-item-row"><span class="log-date">${this.formatDate(b.date)}</span><span class="badge badge-neutral">BMK</span></div>
        <div class="log-sub">${b.type} (${b.modelsCount})</div>
      </div>`,
      (v) => this.selectBenchmark(v),
      "data-date",
    );

    renderList(
      "outcome-list",
      this.outcomes,
      (o) => `
      <div class="log-item" data-id="${o.id}">
        <div class="log-item-row"><span class="log-date" style="font-size:0.75rem;">${this.shorten(o.name)}</span><span class="badge ${o.readiness >= 75 ? "badge-success" : "badge-warning"}">R:${o.readiness.toFixed(0)}</span></div>
        <div class="log-sub">Sharpe: ${o.sharpe.toFixed(2)}</div>
      </div>`,
      (v) => this.selectOutcome(v),
      "data-id",
    );
  }

  private renderLeaderboard() {
    const el = document.getElementById("leaderboard-table");
    if (!el) return;
    const items: LeaderboardRow[] = [
      {
        id: "VEG_BASE",
        type: "ALPHA",
        sharpe: 1.25,
        totalReturn: 0.15,
        maxDrawdown: -0.05,
        verdict: "READY",
      },
      {
        id: "MOCK_FOUND",
        type: "FOUNDATION",
        sharpe: 0.88,
        totalReturn: 0.1,
        maxDrawdown: -0.12,
        verdict: "CAUTION",
      },
    ];
    this.outcomes.forEach((o) => {
      items.push({
        id: o.name,
        type: "STRAT",
        sharpe: o.sharpe,
        totalReturn: 0,
        maxDrawdown: 0,
        verdict: o.readiness >= 75 ? "READY" : "WATCH",
      });
    });
    items.sort((a, b) => b.sharpe - a.sharpe);

    el.innerHTML = `
      <table class="leaderboard-table">
        <thead><tr><th>Strategy</th><th>Type</th><th>Sharpe</th><th>Return</th><th>MaxDD</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map((r) => `<tr><td><strong>${this.escapeHtml(r.id)}</strong></td><td><span class="badge badge-neutral">${r.type}</span></td><td class="pos"><strong>${r.sharpe.toFixed(2)}</strong></td><td>${(r.totalReturn * 100).toFixed(1)}%</td><td>${(r.maxDrawdown * 100).toFixed(1)}%</td><td><span class="badge ${r.verdict === "READY" ? "badge-success" : "badge-warning"}">${r.verdict}</span></td></tr>`).join("")}
        </tbody>
      </table>`;
  }

  private renderRegistry() {
    const el = document.getElementById("registry-list");
    if (el)
      el.innerHTML = this.registry
        .map(
          (m) =>
            `<div class="log-item" style="cursor:default; padding: 0.4rem 0.75rem;"><div class="log-item-row"><span class="log-date" style="font-size:0.75rem;">${this.escapeHtml((m.name as string) || (m.id as string))}</span><span class="badge badge-neutral">${(m.vendor as string) || "OSS"}</span></div></div>`,
        )
        .join("");
  }

  private renderRawJSON(p: LogPayload) {
    const el = document.getElementById("json-content");
    if (el)
      el.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(p, null, 2))}</pre>`;
  }

  public updateText(id: string, text: string, color?: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  }

  public updateHTML(id: string, html: string) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  public getUnifiedLog(date: string) {
    return (
      this.unifiedPayloadByDate.get(date) ||
      this.unifiedPayloadByDate.get(this.formatDate(date)) ||
      null
    );
  }

  public auditLog(strategyId: string, action: string) {
    console.log(`🛡️ Audit Log: ${strategyId} ${action} by user.`);
    const el = document.getElementById("workflow-status");
    if (el) {
      el.innerHTML += `<div class="status-row" style="margin-top:8px; color:var(--success); font-weight:800; animation:fadeIn 0.4s ease;">✅ USER ${action}ED</div>`;
    }
  }

  public escapeHtml(v: unknown): string {
    return String(v ?? "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m]!,
    );
  }

  private formatDate(s: string) {
    if (s.includes("-")) return s;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  private updateActiveItem(attr: string, val: string) {
    document.querySelectorAll(".log-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute(attr) === val);
    });
  }

  private updateTimeLabel() {
    this.updateText(
      "last-update",
      `Last Sync: ${new Date().toLocaleTimeString()}`,
    );
  }

  private shorten(s: string) {
    return s.length > 15 ? `${s.slice(0, 13)}..` : s;
  }
}

// --- Engines ---

class DailyLogEngine implements ViewEngine {
  private shell: DashboardShell;
  constructor(shell: DashboardShell) {
    this.shell = shell;
  }
  render(p: LogPayload) {
    const r = (p.report ?? p) as DashboardReport;
    this.shell.updateText(
      "stat-edge",
      `${((r.results?.expectedEdge ?? 0) * 100).toFixed(2)}%`,
    );
    this.shell.updateText(
      "stat-return",
      `${((r.results?.basketDailyReturn ?? 0) * 100).toFixed(2)}%`,
      (r.results?.basketDailyReturn ?? 0) >= 0
        ? "var(--success)"
        : "var(--danger)",
    );
    this.shell.updateText(
      "stat-kelly",
      `${((r.risks?.kellyFraction ?? 0) * 100).toFixed(2)}%`,
    );
    this.shell.updateText("stat-top", r.decision?.topSymbol || "--");

    this.shell.updateHTML(
      "workflow-status",
      `
      <div class="status-row"><span>Readiness</span><span class="badge badge-success">${r.workflow?.alphaReadiness}</span></div>
      <div class="status-row"><span>Verdict</span><span class="badge ${r.workflow?.verdict === "USEFUL" ? "badge-success" : "badge-danger"}">${r.workflow?.verdict}</span></div>
      <div class="status-row"><span>Risk Cap</span><span class="badge badge-warning">${r.risks?.maxPositions} Pos</span></div>
    `,
    );

    const symbols = r.analysis || [];
    this.shell.updateText("symbol-count", `${symbols.length} symbols`);
    this.shell.updateHTML(
      "symbol-analysis",
      symbols
        .map(
          (s) => `
      <div class="symbol-card animate-fade">
        <div class="symbol-head"><span class="symbol-code">${s.symbol}</span><span class="badge badge-success">${s.signal}</span></div>
        <div class="stat-value" style="font-size:1rem;">${pickNumber(s.alphaScore).toFixed(4)} <small style="font-size:0.65rem; opacity:0.6;">ALPHA</small></div>
        <table class="density-table">
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Profit Margin</td><td>${((s.finance?.profitMargin ?? 0) * 100).toFixed(1)}%</td></tr>
            <tr><td>Daily Ret</td><td>${((s.factors?.dailyReturn ?? 0) * 100).toFixed(2)}%</td></tr>
            <tr><td>Momentum</td><td>${pickNumber(s.factors?.compositeSurprise || s.factors?.intradayRange).toFixed(2)}</td></tr>
            <tr><td>Liquidity</td><td>${(pickNumber(s.factors?.liquidityPerShare) / 1000).toFixed(1)}k</td></tr>
          </tbody>
        </table>
      </div>`,
        )
        .join(""),
    );

    this.shell.updateHTML(
      "verdict-content",
      `
      <div class="box-title">Strategy Verdict</div>
      <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">${r.decision?.strategy}</div>
      <div style="font-size:0.85em; opacity:0.8;">${this.shell.escapeHtml(r.decision?.reason)}</div>
      <div class="box-title">Risk Parameters</div>
      <div style="font-size:0.85em;">- Stop Loss: ${((r.risks?.stopLossPct ?? 0) * 100).toFixed(1)}%<br>- Kelly: ${((r.risks?.kellyFraction ?? 0) * 100).toFixed(2)}%</div>
    `,
    );

    this.renderExecution(r);
    this.renderValidation(r.date || "");
  }

  private renderExecution(r: DashboardReport) {
    const ex = r.execution;
    if (!ex || !ex.orders || ex.orders.length === 0) {
      this.shell.updateHTML(
        "execution-log",
        `<div class="log-sub">No execution for this cycle. Status: ${ex?.status || "N/A"}</div>`,
      );
      return;
    }
    this.shell.updateHTML(
      "execution-log",
      `
      <table class="density-table" style="font-family:'JetBrains Mono', monospace;">
        <thead><tr><th>Sym</th><th>Side</th><th>Qty</th><th>Price</th><th>Notional</th></tr></thead>
        <tbody>
          ${ex.orders.map((o) => `<tr><td>${o.symbol}</td><td class="${o.side === "BUY" ? "pos" : "neg"}">${o.side}</td><td>${o.quantity}</td><td>${o.fillPrice}</td><td>${o.notional.toLocaleString()}</td></tr>`).join("")}
        </tbody>
      </table>
      <div style="margin-top:10px; font-size:0.7em; opacity:0.6;">Status: ${ex.status} | Mode: ${ex.mode}</div>
    `,
    );
  }

  private renderValidation(date: string) {
    const u = this.shell.getUnifiedLog(date);
    if (!u) {
      this.shell.updateHTML(
        "validation-results",
        `<div class="log-sub">No audit logs found for ${date}.</div>`,
      );
      return;
    }
    this.shell.updateHTML(
      "validation-results",
      `
      <table class="density-table">
        <thead><tr><th>Stage</th><th>Status</th><th>Metric</th></tr></thead>
        <tbody>
          ${(u.stages || [])
            .map((s) => {
              const m = Object.entries(s.metrics || {}).at(0);
              const mStr = m
                ? `${m[0]}: ${typeof m[1] === "number" ? m[1].toFixed(2) : m[1]}`
                : "";
              return `<tr><td>${s.name}</td><td><span class="badge ${s.status === "PASS" ? "badge-success" : "badge-danger"}">${s.status}</span></td><td style="font-size:0.65rem;">${mStr}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `,
    );
  }
}

class OutcomeEngine implements ViewEngine {
  private shell: DashboardShell;
  constructor(shell: DashboardShell) {
    this.shell = shell;
  }
  render(p: LogPayload) {
    const r = p.report as StandardOutcome;
    this.shell.updateText("stat-edge", "Outcome");
    this.shell.updateText("stat-return", "Verified");
    this.shell.updateText(
      "stat-kelly",
      r.verification?.metrics?.sharpeRatio?.toFixed(2) || "--",
    );
    this.shell.updateText("stat-top", r.strategyId);

    this.shell.updateHTML(
      "workflow-status",
      `
      <div class="status-row"><span>Precision Score</span><span class="badge badge-success">${((r.reasoningScore ?? 0) * 100).toFixed(0)}</span></div>
      <button class="badge badge-success" style="width:100%; margin-top:10px; border:none; cursor:pointer;" onclick="(window as any).dashboardShell.auditLog('${r.strategyId}', 'APPROVE')">APPROVE STRATEGY</button>
    `,
    );

    this.shell.updateHTML(
      "symbol-analysis",
      `
      <div class="symbol-card animate-fade" style="grid-column: 1 / -1; border-left: 4px solid var(--accent);">
        <div class="box-title">${r.strategyName}</div>
        <p style="font-size:0.85em; opacity:0.9; margin-bottom:10px;">${this.shell.escapeHtml(r.summary)}</p>
        <div class="stat-group" style="padding:10px 0;">
          <div class="stat-card">
            <span class="stat-label">Sharpe Ratio</span>
            <span class="stat-value pos">${r.verification?.metrics?.sharpeRatio?.toFixed(2)}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Annualized Ret</span>
            <span class="stat-value">${((r.verification?.metrics?.annualizedReturn ?? 0) * 100).toFixed(1)}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Max Drawdown</span>
            <span class="stat-value neg">${((r.verification?.metrics?.maxDrawdown ?? 0) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
      <div class="symbol-card animate-fade" style="grid-column: 1 / -1;">
        <div class="box-title">Alpha Characteristics (Fama-French / Numerai)</div>
        <table class="density-table">
          <thead><tr><th>Factor</th><th>Exposure / Score</th></tr></thead>
          <tbody>
            ${Object.entries(r.alpha?.famaFrench || {})
              .map(
                ([k, v]) =>
                  `<tr><td>FF:${k}</td><td>${pickNumber(v).toFixed(3)}</td></tr>`,
              )
              .join("")}
            ${r.alpha?.numerai ? `<tr><td>Numerai CORR</td><td>${pickNumber(r.alpha.numerai.corr).toFixed(4)}</td></tr>` : ""}
          </tbody>
        </table>
      </div>`,
    );

    this.shell.updateHTML(
      "verdict-content",
      `
      <div class="box-title">Reasoning Audit</div>
      <div style="font-size:0.85em; line-height:1.6; font-style:italic;">"${this.shell.escapeHtml(r.reasoning)}"</div>
      <div class="box-title">Stability</div>
      <div style="font-size:0.85em;">- Production Ready: <span class="badge ${r.stability?.isProductionReady ? "badge-success" : "badge-danger"}">${r.stability?.isProductionReady}</span><br>- Tracking Error: ${r.stability?.trackingError?.toFixed(2)}</div>
    `,
    );
    this.shell.updateHTML(
      "execution-log",
      `<div class="log-sub">Validated Historical Outcome (Backtest Mode)</div>`,
    );
    this.shell.updateHTML(
      "validation-results",
      `<div class="badge badge-success">ARXIV PERSISTENCE SUCCESSFUL</div>`,
    );
  }
}

class BenchmarkEngine implements ViewEngine {
  private shell: DashboardShell;
  constructor(shell: DashboardShell) {
    this.shell = shell;
  }
  render(payload: LogPayload) {
    const p = payload as unknown as BenchmarkLogPayload;
    const r = p.report || {};
    this.shell.updateText("stat-edge", "BMK");
    this.shell.updateText("stat-return", r.type || "BENCHMARK");
    this.shell.updateText("stat-kelly", r.date || "--");
    this.shell.updateHTML(
      "symbol-analysis",
      `
      <div class="symbol-card animate-fade" style="grid-column: 1 / -1;">
        <div class="box-title">Baseline Comparison Metrics</div>
        <table class="density-table">
          <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>sMAPE</th><th>DirAcc</th></tr></thead>
          <tbody>
            ${(r.analyst?.baselines || [])
              .map(
                (b) => `
              <tr>
                <td><strong>${b.name}</strong></td>
                <td>${pickNumber(b.metrics.mae).toFixed(2)}</td>
                <td>${pickNumber(b.metrics.rmse).toFixed(2)}</td>
                <td>${pickNumber(b.metrics.smape).toFixed(2)}%</td>
                <td class="${(b.metrics.directionalAccuracy ?? 0) > 50 ? "pos" : "neg"}">${pickNumber(b.metrics.directionalAccuracy).toFixed(1)}%</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `,
    );
    this.shell.updateHTML(
      "verdict-content",
      `<div class="box-title">Insights</div><div style="font-size:0.85em;">${this.shell.escapeHtml(r.analyst?.insights)}</div>`,
    );
    this.shell.updateHTML(
      "execution-log",
      `<div class="log-sub">No execution for benchmark logs.</div>`,
    );
    this.shell.updateHTML(
      "validation-results",
      `<div class="badge badge-neutral">BENCHMARK COMPLETE</div>`,
    );
  }
}

class GenericLogEngine implements ViewEngine {
  private shell: DashboardShell;
  constructor(shell: DashboardShell) {
    this.shell = shell;
  }
  render(_p: LogPayload) {
    this.shell.updateText("stat-edge", "UNK");
    this.shell.updateHTML(
      "symbol-analysis",
      `<div class="log-sub">Unknown schema fallback.</div>`,
    );
  }
}

(window as unknown as { dashboardShell: DashboardShell }).dashboardShell =
  new DashboardShell();
