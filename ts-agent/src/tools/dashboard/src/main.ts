import "./style.css";

interface LogPayload {
  schema: string;
  generatedAt: string;
  report: DashboardReport;
}

interface DailySummary {
  date: string;
  verdict: string;
  expectedEdge: number;
  basketDailyReturn: number;
  topSymbol: string;
  payload?: LogPayload;
}

interface AnalysisSymbol {
  symbol: string;
  signal: string;
  alphaScore: number;
  finance: {
    netSales: number;
    profitMargin: number;
  };
  factors: {
    dailyReturn: number;
  };
}

interface DashboardReport {
  date?: string;
  workflow?: {
    dataReadiness?: string;
    alphaReadiness?: string;
  };
  evidence?: {
    estat?: {
      status?: string;
    };
    jquants?: unknown;
  };
  decision?: {
    topSymbol?: string;
    strategy?: string;
    reason?: string;
  };
  results?: {
    expectedEdge?: number;
    basketDailyReturn?: number;
  };
  risks?: {
    kellyFraction?: number;
  };
  analysis?: AnalysisSymbol[];
  market?: unknown;
}

const API_BASE = "/api";

class Dashboard {
  private logs: DailySummary[] = [];
  private activeLog: LogPayload | null = null;

  constructor() {
    this.init();
  }

  async init() {
    await this.loadLogs();
    const firstLog = this.logs.at(0);
    if (firstLog) {
      await this.selectLog(firstLog.date);
    }

    // Auto refresh every 30s
    setInterval(() => this.loadLogs(), 30000);
  }

  async loadLogs() {
    try {
      const res = await fetch(`${API_BASE}/logs`);
      this.logs = (await res.json()) as DailySummary[];
      this.renderSidebar();
    } catch (e) {
      console.error("Failed to load logs", e);
    }
  }

  async selectLog(date: string) {
    try {
      const res = await fetch(`${API_BASE}/logs/${date}`);
      this.activeLog = (await res.json()) as LogPayload;
      this.renderActiveLog();

      // Update active state in sidebar
      document.querySelectorAll(".log-item").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-date") === date);
      });
    } catch (e) {
      console.error(`Failed to load log for ${date}`, e);
    }
  }

  renderSidebar() {
    const list = document.getElementById("log-list");
    if (!list) return;

    list.innerHTML = this.logs
      .map(
        (log) => `
      <div class="log-item ${this.activeLog?.report.date === log.date ? "active" : ""}" 
           data-date="${this.escapeHtml(log.date)}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">${this.escapeHtml(this.formatDate(log.date))}</span>
          <span class="badge ${log.verdict === "USEFUL" ? "badge-success" : "badge-danger"}">${this.escapeHtml(log.verdict)}</span>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">
          Ret: ${(log.basketDailyReturn * 100).toFixed(2)}% | Edge: ${(log.expectedEdge * 100).toFixed(2)}%
        </div>
      </div>
    `,
      )
      .join("");

    list.querySelectorAll(".log-item").forEach((el) => {
      el.addEventListener("click", () => {
        const date = el.getAttribute("data-date");
        if (date) {
          this.selectLog(date);
        }
      });
    });
  }

  renderActiveLog() {
    if (!this.activeLog) return;
    const report = this.activeLog.report;

    // Header info
    const updateEl = document.getElementById("last-update");
    if (updateEl)
      updateEl.textContent = `LAST SYNC: ${new Date(this.activeLog.generatedAt).toLocaleTimeString()}`;

    // Summary Stats
    this.updateText(
      "stat-edge",
      `${((report.results?.expectedEdge ?? 0) * 100).toFixed(2)}%`,
    );
    this.updateText(
      "stat-return",
      `${((report.results?.basketDailyReturn ?? 0) * 100).toFixed(2)}%`,
      (report.results?.basketDailyReturn ?? 0) >= 0
        ? "var(--success)"
        : "var(--danger)",
    );
    this.updateText(
      "stat-kelly",
      `${((report.risks?.kellyFraction ?? 0) * 100).toFixed(2)}%`,
    );
    this.updateText("stat-top", report.decision?.topSymbol || "--");

    // Workflow Health
    const workflowEl = document.getElementById("workflow-status");
    if (workflowEl) {
      workflowEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>Data Readiness</span>
          <span class="badge ${report.workflow?.dataReadiness === "PASS" ? "badge-success" : "badge-danger"}">${this.escapeHtml(report.workflow?.dataReadiness)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>Alpha Readiness</span>
          <span class="badge ${report.workflow?.alphaReadiness === "PASS" ? "badge-success" : "badge-danger"}">${this.escapeHtml(report.workflow?.alphaReadiness)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span>E-STAT Evidence</span>
          <span class="badge ${report.evidence?.estat?.status === "PASS" ? "badge-success" : "badge-danger"}">${this.escapeHtml(report.evidence?.estat?.status)}</span>
        </div>
      `;
    }

    // Analysis Cards
    const analysisEl = document.getElementById("symbol-analysis");
    if (analysisEl && report.analysis) {
      analysisEl.innerHTML = report.analysis
        .map(
          (s: AnalysisSymbol) => `
        <div class="symbol-card animate-fade">
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-size: 1.1rem; font-weight: 800;">${this.escapeHtml(s.symbol)}</span>
            <span class="badge ${s.signal === "LONG" ? "badge-success" : "badge-neutral"}">${this.escapeHtml(s.signal)}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.75rem;">
            <div>
              <div style="color:var(--text-secondary)">Alpha Score</div>
              <div style="font-weight:700; color:var(--accent-emerald)">${s.alphaScore.toFixed(4)}</div>
            </div>
            <div>
              <div style="color:var(--text-secondary)">Net Sales</div>
              <div style="font-weight:700">¥${(s.finance.netSales / 1e8).toFixed(1)}B</div>
            </div>
            <div>
              <div style="color:var(--text-secondary)">Daily Ret</div>
              <div style="color:${s.factors.dailyReturn >= 0 ? "var(--success)" : "var(--danger)"}">${(s.factors.dailyReturn * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div style="color:var(--text-secondary)">Profit Margin</div>
              <div style="font-weight:700">${(s.finance.profitMargin * 100).toFixed(2)}%</div>
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    }

    // Verdict & Decision
    const verdictEl = document.getElementById("verdict-content");
    if (verdictEl) {
      verdictEl.innerHTML = `
        <div style="color: var(--accent-emerald); font-weight: 800; margin-bottom: 0.5rem;">[STRATEGY]</div>
        <div style="margin-bottom: 1rem;">${this.escapeHtml(report.decision?.strategy || "N/A")}</div>
        <div style="color: var(--accent-emerald); font-weight: 800; margin-bottom: 0.5rem;">[REASONING]</div>
        <div>${this.escapeHtml(report.decision?.reason || "N/A")}</div>
      `;
    }

    // Evidence & Env
    const evidenceEl = document.getElementById("evidence-content");
    if (evidenceEl) {
      evidenceEl.innerHTML = `
        <div style="color: var(--accent-emerald); font-weight: 800; margin-bottom: 0.5rem;">[MARKET_CONTEXT]</div>
        <pre style="margin-bottom: 1rem; color: var(--text-secondary);">${this.escapeHtml(JSON.stringify(report.market, null, 2))}</pre>
        <div style="color: var(--accent-emerald); font-weight: 800; margin-bottom: 0.5rem;">[EVIDENCE_TELEMETRY]</div>
        <pre style="color: var(--text-secondary);">${this.escapeHtml(JSON.stringify(report.evidence?.jquants || {}, null, 2))}</pre>
      `;
    }
  }

  private formatDate(dateStr: string) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  private updateText(id: string, text: string, color?: string) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      if (color) el.style.color = color;
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

// Global instance for onclick handlers
(window as unknown as { dashboard: Dashboard }).dashboard = new Dashboard();
