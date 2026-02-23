import "./style.css";

interface LogPayload {
  schema?: string;
  generatedAt?: string;
  models?: Array<Record<string, unknown>>;
  report?: DashboardReport;
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
  };
}

interface DailySummary {
  date: string;
  verdict: string;
  expectedEdge: number;
  basketDailyReturn: number;
  topSymbol: string;
}

const STATIC_LOGS_BASE = "./logs/daily";

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

class Dashboard {
  private logs: DailySummary[] = [];
  private activeLog: LogPayload | null = null;
  private staticPayloadByDate = new Map<string, LogPayload>();

  constructor() {
    this.init();
  }

  async init() {
    await this.loadStaticLogs();
    const firstLog = this.logs.at(0);
    if (firstLog) {
      await this.selectLog(firstLog.date);
    }
  }

  private async loadStaticLogs() {
    const manifestRes = await fetch(`${STATIC_LOGS_BASE}/manifest.json`);
    if (!manifestRes.ok) {
      throw new Error(`Static manifest fetch failed: ${manifestRes.status}`);
    }

    const files = (await manifestRes.json()) as string[];
    const jsonFiles = files
      .filter((f) => /^\d{8}\.json$/.test(f))
      .sort()
      .reverse();

    const settled = await Promise.allSettled(
      jsonFiles.map(async (file) => {
        const res = await fetch(`${STATIC_LOGS_BASE}/${file}`);
        if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
        const payload = (await res.json()) as LogPayload;
        const date = payload.report?.date || file.replace(".json", "");
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
  }

  private async selectLog(date: string) {
    const payload = this.staticPayloadByDate.get(date);
    if (!payload) return;
    this.activeLog = payload;
    this.renderActiveLog();

    document.querySelectorAll(".log-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-date") === date);
    });
  }

  private renderSidebar() {
    const list = document.getElementById("log-list");
    if (!list) return;

    list.innerHTML = this.logs
      .map(
        (log) => `
      <div class="log-item ${this.activeLog?.report?.date === log.date ? "active" : ""}"
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

    list.querySelectorAll(".log-item").forEach((el) => {
      el.addEventListener("click", () => {
        const date = el.getAttribute("data-date");
        if (date) this.selectLog(date);
      });
    });
  }

  private renderActiveLog() {
    if (!this.activeLog) return;
    const report = this.activeLog.report || {};

    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      const ts = this.activeLog.generatedAt || report.analyzedAt;
      updateEl.textContent = ts ? `更新: ${new Date(ts).toLocaleString("ja-JP")}` : "更新: --";
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
            <div><div class="metric-label">Alpha</div><div class="metric-value">${pickNumber(s.alphaScore).toFixed(4)}</div></div>
            <div><div class="metric-label">日次騰落</div><div class="metric-value ${pickNumber(s.factors?.dailyReturn) >= 0 ? "pos" : "neg"}">${(pickNumber(s.factors?.dailyReturn) * 100).toFixed(2)}%</div></div>
            <div><div class="metric-label">売上高</div><div class="metric-value">¥${(pickNumber(s.finance?.netSales) / 1e8).toFixed(1)}億</div></div>
            <div><div class="metric-label">利益率</div><div class="metric-value">${(pickNumber(s.finance?.profitMargin) * 100).toFixed(2)}%</div></div>
          </div>
        </div>
      `,
        )
        .join("");
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
