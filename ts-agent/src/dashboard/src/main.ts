import "./style.css";

interface DailyLogEnvelope {
  schema?: string;
  generatedAt?: string;
  report?: DailyReport;
  models?: Array<Record<string, unknown>>;
}

interface DailyReport {
  date?: string;
  analyzedAt?: string;
  workflow?: {
    dataReadiness?: string;
    alphaReadiness?: string;
    verdict?: string;
  };
  evidence?: {
    estat?: { status?: string; hasStatsData?: boolean };
    jquants?: { status?: string; listedCount?: number } & Record<
      string,
      unknown
    >;
  };
  decision?: {
    strategy?: string;
    action?: string;
    topSymbol?: string;
    reason?: string;
    experimentValue?: string;
  };
  results?: {
    expectedEdge?: number;
    basketDailyReturn?: number;
    status?: string;
    mode?: string;
    backtest?: {
      totalCostBps?: number;
      netReturn?: number;
      grossReturn?: number;
      tradingDays?: number;
    };
    selectedSymbols?: string[];
  };
  risks?: {
    kellyFraction?: number;
    stopLossPct?: number;
    maxPositions?: number;
  };
  analysis?: AnalysisSymbol[];
  evidenceSource?: "QUANT_BACKTEST" | "LINGUISTIC_ONLY"; // [NEW] Added for Veracity Audit
  execution?: {
    status?: string;
    mode?: string;
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
    profitMargin?: number;
  };
  factors?: {
    dailyReturn?: number;
    prevDailyReturn?: number;
    intradayRange?: number;
    closeStrength?: number;
    liquidityPerShare?: number;
  };
}

interface BenchmarkLogPayload {
  schema?: string;
  generatedAt?: string;
  report?: {
    type?: string;
    benchmarkId?: string;
    date?: string;
    analyst?: {
      insights?: string;
      baselines?: Array<{
        name: string;
        metrics: {
          mae?: number;
          rmse?: number;
          smape?: number;
          directionalAccuracy?: number;
        };
      }>;
    };
  };
}

interface UnifiedLogPayload {
  schema?: string;
  generatedAt?: string;
  date?: string;
  stages?: Array<{
    name?: string;
    status?: string;
    metrics?: Record<string, number | string>;
  }>;
}

interface AlphaDiscoveryCandidate {
  id: string;
  description?: string;
  reasoning?: string;
  score?: number;
  icProxy?: number;
  orthogonality?: number;
  correlationToBaseline?: number;
}

interface AlphaDiscoveryPayload {
  schema?: string;
  date?: string;
  startedAt?: string;
  endedAt?: string;
  selected?: string[];
  evidence?: {
    sampleSize?: number;
    avgIntradayRange?: number;
    avgProfitMargin?: number;
    positiveReturnRatio?: number;
  };
  candidates?: AlphaDiscoveryCandidate[];
}

interface ReadinessLogPayload {
  schema?: string;
  report?: {
    verdict?: string;
    score?: {
      total?: number;
    };
    recommendations?: string[];
    sampleSize?: number;
  };
}

interface UQTLEvent {
  id: string;
  timestamp: string;
  type: string;
  agent_id?: string;
  experiment_id?: string;
  payload_json: string;
  metadata_json?: string;
}

type LogBucket = "daily" | "benchmarks" | "unified" | "readiness";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface WorkflowMeta {
  id: string;
  name: string;
  file: string;
  commandCount: number;
  commands: string[];
}

interface WorkflowStepResult {
  command: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

interface WorkflowRunResult {
  workflowId: string;
  workflowName: string;
  startedAt: string;
  endedAt: string;
  ok: boolean;
  steps: WorkflowStepResult[];
}

interface TimeSeriesView {
  id: string;
  csvFile: string;
  plotFile: string;
  hasPlot: boolean;
  required: boolean;
}

const pickNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const canonicalDate = (value: string | undefined): string => {
  if (!value) return "";
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : "";
};

const formatDate = (value: string): string => {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

const formatPercent = (value: number, digits = 2): string =>
  `${(value * 100).toFixed(digits)}%`;

const formatSignedPercent = (value: number, digits = 2): string => {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value, digits)}`;
};

const formatBps = (value: number): string => `${value.toFixed(1)} bps`;

const formatCompact = (value: number): string =>
  new Intl.NumberFormat("ja-JP", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m] ?? m,
  );

const shortId = (value: string, width = 8): string =>
  value.length <= width ? value : `${value.slice(0, width)}…`;

const fetchJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> => {
  try {
    const res = await fetch(path, { cache: "no-store", ...(init ?? {}) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (_error) {
    return null;
  }
};

class InvestorDashboard {
  private dailyByDate = new Map<string, DailyLogEnvelope>();

  private benchmarkByDate = new Map<string, BenchmarkLogPayload>();

  private unifiedByDate = new Map<string, UnifiedLogPayload>();

  private readinessByDate = new Map<string, ReadinessLogPayload>();

  private alphaByDate = new Map<string, AlphaDiscoveryPayload[]>();

  private uqtlEvents: UQTLEvent[] = [];

  private timeline: string[] = [];

  private activeDate = "";

  private workflows: WorkflowMeta[] = [];

  private timeSeriesViews: TimeSeriesView[] = [];

  private workflowRunning = false;

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap() {
    this.bindEvents();
    await this.refresh();
    await this.refreshUqtl();
    await this.refreshWorkflowAndViews();
    window.setInterval(() => {
      void this.refresh();
    }, 60000);
    window.setInterval(() => {
      void this.refreshUqtl();
    }, 5000);
    window.setInterval(() => {
      void this.refreshWorkflowAndViews();
    }, 20000);
  }

  private bindEvents() {
    const refreshButton = document.getElementById("refresh-btn");
    refreshButton?.addEventListener("click", () => {
      void this.refresh();
      void this.refreshWorkflowAndViews();
    });

    const workflowRunButton = document.getElementById("workflow-run-btn");
    workflowRunButton?.addEventListener("click", () => {
      void this.runSelectedWorkflow();
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const tab = target.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });
  }

  private switchTab(tabId: string) {
    // Update buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn as HTMLButtonElement).dataset.tab === tabId,
      );
    });
    // Update content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === `tab-${tabId}`);
    });
  }

  private async listLogFiles(bucket: LogBucket): Promise<string[]> {
    const liveIndex = await fetchJson<string[]>(
      `/logs/__index?bucket=${encodeURIComponent(bucket)}`,
    );
    if (liveIndex && liveIndex.length > 0) {
      return liveIndex.filter((file) => file.endsWith(".json")).sort();
    }

    const manifest = await fetchJson<string[]>(
      `./logs/${bucket}/manifest.json`,
    );
    if (!manifest) return [];
    return manifest.filter((file) => file.endsWith(".json")).sort();
  }

  private async fetchLogFile<T>(
    bucket: LogBucket,
    file: string,
  ): Promise<T | null> {
    return (
      (await fetchJson<T>(`/logs/${bucket}/${file}`)) ??
      (await fetchJson<T>(`./logs/${bucket}/${file}`))
    );
  }

  private async refresh() {
    await Promise.all([
      this.loadDailyLogs(),
      this.loadBenchmarkLogs(),
      this.loadUnifiedLogs(),
    ]);
    this.renderTimeline();

    if (!this.activeDate || !this.dailyByDate.has(this.activeDate)) {
      this.activeDate = this.timeline[0] ?? "";
    }

    this.renderCurrentView();
    this.updateText(
      "sync-label",
      `同期: ${new Date().toLocaleTimeString("ja-JP")}`,
    );
    this.updateText(
      "coverage-label",
      `${this.timeline.length} 日分 / ベンチ ${this.benchmarkByDate.size} 件`,
    );
  }

  private async loadDailyLogs() {
    const files = await this.listLogFiles("daily");
    if (files.length === 0) return;
    const nextDailyMap = new Map<string, DailyLogEnvelope>();
    const stems = new Set<string>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await this.fetchLogFile<DailyLogEnvelope>(
          "daily",
          file,
        );
        if (!payload) return;
        const stem = file.replace(/\.json$/, "");
        stems.add(stem);
        const date = canonicalDate(payload.report?.date ?? stem);
        if (!date) return;
        nextDailyMap.set(date, payload);
      }),
    );

    this.dailyByDate = nextDailyMap;
    this.timeline = Array.from(this.dailyByDate.keys()).sort((a, b) =>
      b.localeCompare(a),
    );

    await this.loadReadinessLogs(stems);
  }

  private async loadReadinessLogs(stems: Set<string>) {
    const nextReadinessMap = new Map<string, ReadinessLogPayload>();
    const candidates = new Set<string>();
    const readinessFiles = await this.listLogFiles("readiness");

    for (const date of this.timeline) {
      candidates.add(date);
    }
    for (const stem of stems) {
      candidates.add(stem);
    }
    for (const file of readinessFiles) {
      candidates.add(file.replace(/\.json$/, ""));
    }

    await Promise.all(
      Array.from(candidates).map(async (stem) => {
        const payload = await this.fetchLogFile<ReadinessLogPayload>(
          "readiness",
          `${stem}.json`,
        );
        if (!payload?.report) return;
        const date = canonicalDate(stem);
        if (!date) return;
        nextReadinessMap.set(date, payload);
      }),
    );

    this.readinessByDate = nextReadinessMap;
  }

  private async loadBenchmarkLogs() {
    const files = await this.listLogFiles("benchmarks");
    if (files.length === 0) return;
    const nextBenchMap = new Map<string, BenchmarkLogPayload>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await this.fetchLogFile<BenchmarkLogPayload>(
          "benchmarks",
          file,
        );
        if (!payload) return;
        const date = canonicalDate(
          payload.report?.date ?? file.replace(/\.json$/, ""),
        );
        if (!date) return;
        nextBenchMap.set(date, payload);
      }),
    );

    this.benchmarkByDate = nextBenchMap;
  }

  private async loadUnifiedLogs() {
    const files = await this.listLogFiles("unified");
    if (files.length === 0) return;
    const nextUnifiedMap = new Map<string, UnifiedLogPayload>();
    const nextAlphaByDate = new Map<string, AlphaDiscoveryPayload[]>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await this.fetchLogFile<Record<string, unknown>>(
          "unified",
          file,
        );
        if (!payload) return;

        const schema = typeof payload.schema === "string" ? payload.schema : "";
        if (schema === "investor.unified-log.v1") {
          const normalized = canonicalDate(
            typeof payload.date === "string"
              ? payload.date
              : file.replace(/\.json$/, ""),
          );
          if (!normalized) return;
          nextUnifiedMap.set(normalized, payload as UnifiedLogPayload);
          return;
        }

        if (schema === "investor.alpha-discovery.v1") {
          const normalized = canonicalDate(
            typeof payload.date === "string"
              ? payload.date
              : file.replace(/\.json$/, ""),
          );
          if (!normalized) return;
          const bucket = nextAlphaByDate.get(normalized) ?? [];
          bucket.push(payload as AlphaDiscoveryPayload);
          nextAlphaByDate.set(normalized, bucket);
        }
      }),
    );

    this.unifiedByDate = nextUnifiedMap;
    this.alphaByDate = nextAlphaByDate;
  }

  private async refreshUqtl() {
    const events = await fetchJson<UQTLEvent[]>("/api/uqtl?limit=100");
    if (events) {
      this.uqtlEvents = events;
      this.renderUqtlFeed();
    }
  }

  private async refreshWorkflowAndViews() {
    await Promise.all([this.loadWorkflows(), this.loadTimeSeriesViews()]);
    this.renderWorkflowControls();
    this.renderTimeSeriesViews();
  }

  private async loadWorkflows() {
    const workflows = await fetchJson<WorkflowMeta[]>("/api/workflows");
    if (!workflows) return;
    this.workflows = workflows
      .filter((workflow) => workflow.commandCount > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private async loadTimeSeriesViews() {
    const views = await fetchJson<TimeSeriesView[]>("/api/timeseries/views");
    if (!views) return;
    this.timeSeriesViews = views;
  }

  private renderWorkflowControls() {
    const select = document.getElementById("workflow-select");
    if (!(select instanceof HTMLSelectElement)) return;

    const statusEl = document.getElementById("workflow-status");
    const outputEl = document.getElementById("workflow-output");
    const previous = select.value;

    if (this.workflows.length === 0) {
      select.innerHTML = '<option value="">実行可能なワークフローなし</option>';
      select.disabled = true;
      if (statusEl) statusEl.textContent = "ワークフロー未検出";
      if (outputEl)
        outputEl.textContent =
          "`.agent/workflows` から実行可能コマンドを検出できません。";
      this.updateWorkflowButtonState();
      return;
    }

    select.innerHTML = this.workflows
      .map((workflow) => {
        const label = `${workflow.id} / ${workflow.commandCount} step`;
        return `<option value="${escapeHtml(workflow.id)}">${escapeHtml(label)}</option>`;
      })
      .join("");

    const exists = this.workflows.some((workflow) => workflow.id === previous);
    select.value = exists ? previous : (this.workflows[0]?.id ?? "");
    select.disabled = this.workflowRunning;

    if (statusEl && !this.workflowRunning && !statusEl.textContent) {
      statusEl.textContent = "待機中";
    }

    if (outputEl && !outputEl.textContent) {
      outputEl.textContent = "実行ログ未取得";
    }

    this.updateWorkflowButtonState();
  }

  private updateWorkflowButtonState() {
    const button = document.getElementById("workflow-run-btn");
    const select = document.getElementById("workflow-select");
    if (!(button instanceof HTMLButtonElement)) return;
    if (!(select instanceof HTMLSelectElement)) return;
    const enabled = !this.workflowRunning && this.workflows.length > 0;
    button.disabled = !enabled;
    button.textContent = this.workflowRunning ? "実行中" : "実行";
    select.disabled = !enabled;
  }

  private async runSelectedWorkflow() {
    if (this.workflowRunning) return;

    const select = document.getElementById("workflow-select");
    if (!(select instanceof HTMLSelectElement)) return;

    const workflowId = select.value.trim();
    if (!workflowId) return;

    const statusEl = document.getElementById("workflow-status");
    const outputEl = document.getElementById("workflow-output");

    this.workflowRunning = true;
    this.updateWorkflowButtonState();
    if (statusEl) statusEl.textContent = `実行中: ${workflowId}`;
    if (outputEl) outputEl.textContent = "処理開始...";

    const result = await fetchJson<WorkflowRunResult>("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId }),
    });

    if (!result) {
      if (statusEl) statusEl.textContent = `失敗: ${workflowId}`;
      if (outputEl)
        outputEl.textContent =
          "実行結果の取得に失敗しました。API サーバを確認してください。";
      this.workflowRunning = false;
      this.updateWorkflowButtonState();
      return;
    }

    const lines = [
      `workflow: ${result.workflowName} (${result.workflowId})`,
      `started: ${result.startedAt}`,
      `ended: ${result.endedAt}`,
      `ok: ${result.ok}`,
      "",
      ...result.steps.flatMap((step, index) => [
        `step ${index + 1}: ${step.command}`,
        `  ok: ${step.ok} / exitCode: ${step.exitCode} / durationMs: ${step.durationMs}`,
        step.stdout ? `  stdout:\n${step.stdout}` : "  stdout: <empty>",
        step.stderr ? `  stderr:\n${step.stderr}` : "  stderr: <empty>",
        "",
      ]),
    ];

    if (statusEl) {
      statusEl.textContent = result.ok
        ? `完了: ${workflowId}`
        : `失敗: ${workflowId}`;
    }
    if (outputEl) outputEl.textContent = lines.join("\n");

    await this.refresh();
    await this.refreshUqtl();
    await this.refreshWorkflowAndViews();

    this.workflowRunning = false;
    this.updateWorkflowButtonState();
  }

  private renderTimeSeriesViews() {
    const host = document.getElementById("ts-view-grid");
    const requiredHost = document.getElementById("ts-view-required");
    if (!host) return;

    if (this.timeSeriesViews.length === 0) {
      host.innerHTML =
        '<div class="empty">時系列ビューが見つかりません。</div>';
      if (requiredHost) {
        requiredHost.classList.remove("ready", "risk");
        requiredHost.textContent = "必須ビュー欠落: sbg_ts.csv";
        requiredHost.classList.add("risk");
      }
      return;
    }

    const requiredView = this.timeSeriesViews.find((view) => view.required);
    const hasRequiredView = Boolean(requiredView?.hasPlot);
    if (requiredHost) {
      requiredHost.classList.remove("ready", "risk");
      if (hasRequiredView) {
        requiredHost.textContent = `必須ビュー確認済: ${requiredView?.id}`;
        requiredHost.classList.add("ready");
      } else {
        requiredHost.textContent =
          "必須ビュー欠落: sbg_ts.csv の画像が必要です";
        requiredHost.classList.add("risk");
      }
    }

    host.innerHTML = this.timeSeriesViews
      .map((view) => {
        const requirementLabel = view.required ? "必須" : "任意";
        const body = view.hasPlot
          ? `<img class="ts-image" src="/api/timeseries/plot/${encodeURIComponent(view.plotFile)}?t=${Date.now()}" alt="${escapeHtml(view.id)}" />`
          : '<div class="empty">画像未生成</div>';
        return `
          <article class="ts-card ${view.required ? "required" : ""}">
            <div class="ts-card-head">
              <strong>${escapeHtml(view.id)}</strong>
              <span class="chip ${view.required ? "ready" : "neutral"}">${escapeHtml(requirementLabel)}</span>
            </div>
            <div class="ts-card-body">${body}</div>
            <div class="ts-card-links">
              <a href="/api/timeseries/csv/${encodeURIComponent(view.csvFile)}" target="_blank" rel="noreferrer">${escapeHtml(view.csvFile)}</a>
              <span>${escapeHtml(view.plotFile)}</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  private renderTimeline() {
    const timelineEl = document.getElementById("timeline-list");
    if (!timelineEl) return;

    if (this.timeline.length === 0) {
      timelineEl.innerHTML =
        '<div class="empty">ログが見つかりません。まず <code>task run</code> を実行してください。</div>';
      return;
    }

    timelineEl.innerHTML = this.timeline
      .map((date, index) => {
        const daily = this.dailyByDate.get(date);
        const report = daily?.report;
        const verdict =
          report?.workflow?.verdict ??
          report?.decision?.experimentValue ??
          report?.results?.status ??
          "UNKNOWN";
        const dailyReturn = pickNumber(report?.results?.basketDailyReturn);
        return `
          <button class="timeline-item ${this.activeDate === date ? "active" : ""}" data-date="${date}" style="--delay:${index * 40}ms">
            <div class="timeline-top">
              <span class="timeline-date">${formatDate(date)}</span>
              <span class="chip ${this.chipClass(verdict)}">${escapeHtml(verdict)}</span>
            </div>
            <div class="timeline-bottom ${dailyReturn >= 0 ? "pos" : "neg"}">
              ${formatSignedPercent(dailyReturn)}
            </div>
          </button>
        `;
      })
      .join("");

    timelineEl
      .querySelectorAll<HTMLButtonElement>(".timeline-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const date = item.dataset.date;
          if (!date) return;
          this.activeDate = date;
          this.renderTimeline();
          this.renderCurrentView();
        });
      });
  }

  private renderCurrentView() {
    if (!this.activeDate) {
      this.renderEmptyState();
      return;
    }

    const dailyEnvelope = this.dailyByDate.get(this.activeDate);
    if (!dailyEnvelope?.report) {
      this.renderEmptyState();
      return;
    }

    const report = dailyEnvelope.report;
    const analysis = report.analysis ?? [];
    const benchmark = this.pickBenchmark(this.activeDate);
    const unified = this.unifiedByDate.get(this.activeDate) ?? null;
    const readiness = this.pickReadiness(this.activeDate);
    const alpha = this.pickAlphaDiscovery(this.activeDate);

    const expectedEdge = pickNumber(report.results?.expectedEdge);
    const dailyReturn = pickNumber(report.results?.basketDailyReturn);
    const kelly = pickNumber(report.risks?.kellyFraction);
    const stopLoss = pickNumber(report.risks?.stopLossPct);
    const maxPositions = pickNumber(report.risks?.maxPositions);
    const avgAlpha =
      analysis.length > 0
        ? analysis.reduce((sum, row) => sum + pickNumber(row.alphaScore), 0) /
          analysis.length
        : 0;
    const avgProfitMargin =
      analysis.length > 0
        ? analysis.reduce(
            (sum, row) => sum + pickNumber(row.finance?.profitMargin),
            0,
          ) / analysis.length
        : 0;
    const avgRange =
      analysis.length > 0
        ? analysis.reduce(
            (sum, row) => sum + pickNumber(row.factors?.intradayRange),
            0,
          ) / analysis.length
        : 0;
    const avgLiquidity =
      analysis.length > 0
        ? analysis.reduce(
            (sum, row) => sum + pickNumber(row.factors?.liquidityPerShare),
            0,
          ) / analysis.length
        : 0;
    const confidence = this.computeConfidence(report, readiness);
    const uqtlVector = this.computeUqtlVector(report, unified, readiness);

    const posture =
      confidence >= 0.75 ? "攻め寄り" : confidence >= 0.5 ? "中立" : "守り寄り";

    this.updateText("current-date", formatDate(this.activeDate));
    this.updateText(
      "hero-title",
      `${report.decision?.action ?? "次のアクション判定を計算中"} // UQTL`,
    );
    this.updateText("hero-subtitle", report.decision?.strategy ?? "戦略未設定");
    this.updateText("posture-chip", posture);
    this.updateText(
      "hero-reason",
      report.decision?.reason ?? "根拠ログが未記録です。",
    );

    const confidenceBar = document.getElementById("confidence-bar");
    if (confidenceBar) {
      confidenceBar.setAttribute(
        "style",
        `width:${(confidence * 100).toFixed(0)}%`,
      );
    }
    this.updateText(
      "confidence-label",
      `${(confidence * 100).toFixed(0)} / 100`,
    );
    const entropyLabel = `Entropy ${(uqtlVector.entropy * 100).toFixed(0)}`;
    this.updateText("entropy-chip", entropyLabel);
    const entropyChip = document.getElementById("entropy-chip");
    entropyChip?.classList.remove("ready", "caution", "risk", "neutral");
    entropyChip?.classList.add(
      uqtlVector.entropy < 0.35
        ? "ready"
        : uqtlVector.entropy < 0.6
          ? "caution"
          : "risk",
    );

    this.renderKpi("kpi-edge", formatPercent(expectedEdge), expectedEdge);
    this.renderKpi("kpi-return", formatSignedPercent(dailyReturn), dailyReturn);
    this.renderKpi("kpi-kelly", formatPercent(kelly), kelly - 0.1);
    this.renderKpi("kpi-stop", formatPercent(stopLoss), -stopLoss);
    this.renderKpi("kpi-symbol", report.decision?.topSymbol ?? "--", 0);
    this.renderKpi("kpi-liquidity", formatCompact(avgLiquidity), avgLiquidity);

    this.renderDataHealth(report, readiness, maxPositions);
    this.renderTimeSeriesCharts();
    this.renderFlowChart(report);
    this.renderSymbolTable(analysis);
    this.renderStageTable(unified);
    this.renderBenchmark(benchmark);
    this.renderAlphaDiscovery(alpha);
    this.renderUqtlStream(uqtlVector);
    this.renderEvidenceBonding(report, unified);
    this.renderSelfHealingDag(unified);
    void this.renderIntegrityIndicator({
      date: this.activeDate,
      report,
      unified,
      alpha,
    });

    const insightBlocks = [
      `トップ銘柄: ${report.decision?.topSymbol ?? "--"}`,
      `採用銘柄数: ${report.results?.selectedSymbols?.length ?? analysis.length}`,
      `平均アルファスコア: ${avgAlpha.toFixed(3)}`,
      `利益率平均: ${formatPercent(avgProfitMargin)}`,
      `日中レンジ平均: ${formatPercent(avgRange)}`,
      `実行ステータス: ${report.execution?.status ?? "NO_EXECUTION"}`,
    ];
    this.updateHTML(
      "thesis-block",
      insightBlocks
        .map((line) => `<div class="thesis-row">${escapeHtml(line)}</div>`)
        .join(""),
    );

    this.updateHTML(
      "raw-json",
      `<pre>${escapeHtml(
        JSON.stringify(
          {
            daily: report,
            benchmark: benchmark?.report ?? null,
            unified,
            alphaDiscovery: alpha,
          },
          null,
          2,
        ),
      )}</pre>`,
    );
  }

  private computeUqtlVector(
    report: DailyReport,
    unified: UnifiedLogPayload | null,
    readiness: ReadinessLogPayload | null,
  ): {
    time: number;
    logic: number;
    risk: number;
    data: number;
    entropy: number;
  } {
    const readinessScore = clamp01(
      pickNumber(readiness?.report?.score?.total) / 100,
    );
    const stageRows = unified?.stages ?? [];
    const passStages = stageRows.filter((stage) =>
      (stage.status ?? "").toUpperCase().includes("PASS"),
    ).length;
    const logic =
      stageRows.length > 0 ? clamp01(passStages / stageRows.length) : 0.45;
    const stopLoss = pickNumber(report.risks?.stopLossPct);
    const kelly = pickNumber(report.risks?.kellyFraction);
    const risk = clamp01(1 - stopLoss * 4 + kelly * 0.6);
    const evidencePassCount = [
      report.evidence?.estat?.status,
      report.evidence?.jquants?.status,
      report.results?.status,
    ].filter((status) => (status ?? "").toUpperCase().includes("PASS")).length;
    const data = clamp01(evidencePassCount / 3);
    const time = clamp01(readinessScore * 0.6 + data * 0.4);
    const certainty = (time + logic + risk + data) / 4;
    const entropy = clamp01(1 - certainty);
    return { time, logic, risk, data, entropy };
  }

  private renderUqtlFeed() {
    const host = document.getElementById("uqtl-stream");
    if (!host) return;

    if (this.uqtlEvents.length === 0) {
      host.innerHTML = '<div class="empty">UQTL イベント待ち...</div>';
      return;
    }

    host.innerHTML = `
      <div class="uqtl-ledger">
        ${this.uqtlEvents
          .map((event) => {
            const date = new Date(event.timestamp).toLocaleTimeString("ja-JP");
            const payload = JSON.parse(event.payload_json);
            let detail = "";
            if (event.type === "ALPHA_GENERATED")
              detail = `Count: ${payload.count} / Div: ${payload.diversity}`;
            if (event.type === "BACKTEST_COMPLETED")
              detail = `Ret: ${formatSignedPercent(payload.netReturn)} / SR: ${payload.sharpe?.toFixed(2)}`;

            return `
            <div class="uqtl-event">
              <div class="uqtl-evt-meta">
                <span class="uqtl-time">${date}</span>
                <span class="uqtl-type">${event.type}</span>
              </div>
              <div class="uqtl-evt-agent">${event.agent_id || "SYSTEM"}</div>
              <div class="uqtl-evt-detail">${escapeHtml(detail)}</div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  private renderUqtlStream(_vector: {
    time: number;
    logic: number;
    risk: number;
    data: number;
    entropy: number;
  }) {
    // Keeping vector logic as a secondary summary if needed, but primary focus is the feed now.
    this.renderUqtlFeed();
  }

  private renderEvidenceBonding(
    report: DailyReport,
    unified: UnifiedLogPayload | null,
  ) {
    const evidenceRows: Array<{ kind: string; id: string; value: string }> = [];
    const analysis = report.analysis ?? [];
    const topSymbols = [...analysis]
      .sort((a, b) => pickNumber(b.alphaScore) - pickNumber(a.alphaScore))
      .slice(0, 4);

    for (const symbol of topSymbols) {
      const alpha = pickNumber(symbol.alphaScore).toFixed(3);
      evidenceRows.push({
        kind: "factor",
        id: `${this.activeDate}-sym-${symbol.symbol}`,
        value: `${symbol.symbol} / alpha ${alpha}`,
      });
    }

    const orders = report.execution?.orders ?? [];
    for (const order of orders.slice(0, 3)) {
      const orderId =
        typeof order.executedAt === "string"
          ? `${order.symbol}-${order.executedAt}`
          : order.symbol;
      evidenceRows.push({
        kind: "execution",
        id: orderId,
        value: `${order.symbol} ${order.side} ${formatBps(pickNumber(order.fillPrice) * 0.01)}`,
      });
    }

    const stages = unified?.stages ?? [];
    for (const stage of stages.slice(0, 3)) {
      evidenceRows.push({
        kind: "logic",
        id: `${this.activeDate}-stg-${stage.name ?? "unknown"}`,
        value: `${stage.name ?? "Unknown"} / ${stage.status ?? "UNKNOWN"}`,
      });
    }

    if (evidenceRows.length === 0) {
      this.updateHTML(
        "evidence-bonding",
        `<div class="empty">結合できる証拠データが見つかりません。</div>`,
      );
      return;
    }

    this.updateHTML(
      "evidence-bonding",
      evidenceRows
        .slice(0, 10)
        .map(
          (row, index) => `
          <div class="bonding-row" style="--pulse-delay:${(index * 120) % 700}ms">
            <span class="bond-dot ${row.kind}"></span>
            <span class="bond-id">${escapeHtml(shortId(row.id, 24))}</span>
            <span class="bond-value">${escapeHtml(row.value)}</span>
          </div>
        `,
        )
        .join(""),
    );
  }

  private renderSelfHealingDag(unified: UnifiedLogPayload | null) {
    const stages = (unified?.stages ?? []).slice(0, 7);
    if (stages.length === 0) {
      this.updateHTML(
        "dag-map",
        `<div class="empty">DAG ログがありません。</div>`,
      );
      return;
    }

    const width = 980;
    const height = 220;
    const left = 56;
    const right = 50;
    const top = 64;
    const step = (width - left - right) / Math.max(1, stages.length - 1);

    const points = stages.map((stage, index) => {
      const x = left + step * index;
      const status = (stage.status ?? "UNKNOWN").toUpperCase();
      const y =
        status.includes("FAIL") || status.includes("ERROR")
          ? top + 62
          : status.includes("WARN")
            ? top + 34
            : top;
      return {
        x,
        y,
        stage,
        status,
      };
    });

    const edges = points
      .slice(0, -1)
      .map((point, index) => {
        const next = points[index + 1];
        if (!next) return "";
        const rejected =
          point.status.includes("FAIL") || point.status.includes("ERROR");
        const clazz = rejected ? "dag-edge blocked" : "dag-edge";
        return `<line x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}" class="${clazz}" />`;
      })
      .join("");

    const reroutes = points
      .slice(0, -2)
      .map((point, index) => {
        if (
          !(point.status.includes("FAIL") || point.status.includes("ERROR"))
        ) {
          return "";
        }
        const target = points[index + 2];
        if (!target) return "";
        return `<path d="M ${point.x} ${point.y} Q ${(point.x + target.x) / 2} ${point.y - 48}, ${target.x} ${target.y}" class="dag-reroute" />`;
      })
      .join("");

    const nodes = points
      .map((point) => {
        const stateClass = point.status.includes("PASS")
          ? "pass"
          : point.status.includes("FAIL") || point.status.includes("ERROR")
            ? "fail"
            : point.status.includes("WARN")
              ? "warn"
              : "unknown";
        return `
          <g transform="translate(${point.x},${point.y})" class="dag-node ${stateClass}">
            <circle r="14"></circle>
            <text y="34">${escapeHtml(shortId(point.stage.name ?? "Unknown", 11))}</text>
          </g>
        `;
      })
      .join("");

    this.updateHTML(
      "dag-map",
      `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="dag-svg" role="img" aria-label="self-healing DAG">
        ${edges}
        ${reroutes}
        ${nodes}
      </svg>
      `,
    );
  }

  private async renderIntegrityIndicator(input: {
    date: string;
    report: DailyReport;
    unified: UnifiedLogPayload | null;
    alpha: AlphaDiscoveryPayload | null;
  }) {
    const host = document.getElementById("integrity-indicator");
    if (!host) return;
    host.classList.remove("verified", "self-reported", "audited");
    host.textContent = "証拠整合性: 計算中...";

    // 1. Hash Integrity (Local File Consistency)
    try {
      const digest = await this.sha256Hex(
        JSON.stringify({
          date: input.date,
          report: input.report,
          unified: input.unified,
          alpha: input.alpha,
        }),
      );
      if (this.activeDate !== input.date) return;

      // 2. Veracity Audit (Cross-reference with UQTL Ledger)
      const strategyId =
        input.report.decision?.strategy ||
        input.report.analysis?.[0]?.symbol ||
        "UNKNOWN";
      const auditedEvent = this.uqtlEvents.find((e) => {
        if (e.type !== "BACKTEST_COMPLETED") return false;
        try {
          const payload = JSON.parse(e.payload_json);
          // Check if strategy name or id matches
          return (
            payload.strategyId === strategyId ||
            input.report.decision?.strategy?.includes(payload.strategyId)
          );
        } catch {
          return false;
        }
      });

      if (auditedEvent) {
        const payload = JSON.parse(auditedEvent.payload_json);
        host.innerHTML = `証拠不変性: <span class="audited-text">AUDITED ✅</span> / Ledger: ${shortId(auditedEvent.id, 8)} / Hash: ${shortId(digest, 8)}`;
        host.classList.add("verified", "audited");

        // Audit log in console for PM verification
        console.log(
          `[AUDIT] Match found: Strategy ${strategyId} verified by UQTL Event ${auditedEvent.id}. NetReturn: ${payload.netReturn}`,
        );
      } else if (
        input.report.evidenceSource === "QUANT_BACKTEST" ||
        input.report.results?.backtest
      ) {
        host.innerHTML = `証拠不変性: <span class="caution-text">SELF-REPORTED ⚠️</span> / Hash: ${shortId(digest, 8)}`;
        host.classList.add("verified", "self-reported");
      } else {
        host.innerHTML = `証拠不変性: <span class="risk-text">UNAUDITED ❌</span> / Hash: ${shortId(digest, 8)}`;
        host.classList.add("verified");
      }
    } catch (_error) {
      host.textContent = "証拠整合性: HASH ERROR";
      host.classList.remove("verified");
    }
  }

  private async sha256Hex(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private renderDataHealth(
    report: DailyReport,
    readiness: ReadinessLogPayload | null,
    maxPositions: number,
  ) {
    const evidenceItems = [
      {
        label: "J-Quants",
        status: report.evidence?.jquants?.status ?? "UNKNOWN",
      },
      {
        label: "e-Stat",
        status: report.evidence?.estat?.status ?? "UNKNOWN",
      },
      {
        label: "Readiness",
        status: readiness?.report?.verdict ?? "N/A",
      },
      {
        label: "ポジション上限",
        status: maxPositions > 0 ? `${maxPositions}` : "N/A",
      },
    ];

    const healthHtml = evidenceItems
      .map(
        (item) => `
          <div class="health-row">
            <span>${escapeHtml(item.label)}</span>
            <span class="chip ${this.chipClass(item.status)}">${escapeHtml(item.status)}</span>
          </div>
        `,
      )
      .join("");

    this.updateHTML("data-health", healthHtml);
    this.updateHTML("data-health-signals", healthHtml);
  }

  private renderTimeSeriesCharts() {
    const returnSeries = this.buildReturnSeries(80);
    const alphaSeries = this.buildAlphaSeries(80);

    this.renderLineChart("return-chart", {
      series: returnSeries,
      formatter: (value) => formatSignedPercent(value),
      yAxisLabel: "Return",
      positiveIsGood: true,
    });
    this.renderLineChart("alpha-chart", {
      series: alphaSeries,
      formatter: (value) => value.toFixed(3),
      yAxisLabel: "Alpha",
      positiveIsGood: true,
    });
  }

  private buildReturnSeries(limit: number): TimeSeriesPoint[] {
    return [...this.timeline]
      .slice(0, limit)
      .reverse()
      .map((date) => ({
        date,
        value: pickNumber(
          this.dailyByDate.get(date)?.report?.results?.basketDailyReturn,
        ),
      }));
  }

  private buildAlphaSeries(limit: number): TimeSeriesPoint[] {
    return [...this.timeline]
      .slice(0, limit)
      .reverse()
      .map((date) => {
        const analysis = this.dailyByDate.get(date)?.report?.analysis ?? [];
        const avgAlpha =
          analysis.length > 0
            ? analysis.reduce(
                (sum, row) => sum + pickNumber(row.alphaScore),
                0,
              ) / analysis.length
            : 0;
        return { date, value: avgAlpha };
      });
  }

  private renderLineChart(
    id: string,
    input: {
      series: TimeSeriesPoint[];
      formatter: (value: number) => string;
      yAxisLabel: string;
      positiveIsGood: boolean;
    },
  ) {
    const series = input.series;
    if (series.length < 2) {
      this.updateHTML(
        id,
        `<div class="empty">時系列データが不足しています。</div>`,
      );
      return;
    }

    const values = series.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const width = 760;
    const height = 220;
    const left = 46;
    const right = 16;
    const top = 16;
    const bottom = 32;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const x = (index: number) =>
      left +
      (series.length === 1 ? 0 : (index / (series.length - 1)) * chartWidth);
    const y = (value: number) =>
      top + ((max - value) / (max - min)) * chartHeight;

    const polyline = series
      .map(
        (point, index) => `${x(index).toFixed(2)},${y(point.value).toFixed(2)}`,
      )
      .join(" ");
    const areaPath = `M ${x(0).toFixed(2)} ${height - bottom} L ${polyline.replaceAll(" ", " L ")} L ${x(series.length - 1).toFixed(2)} ${height - bottom} Z`;

    const active = series.find((point) => point.date === this.activeDate);
    const latest = series[series.length - 1];
    const previous = series[series.length - 2];
    if (!latest || !previous) return;
    const delta = latest.value - previous.value;
    const axisMid = (max + min) / 2;
    const trendClass =
      input.positiveIsGood && delta > 0
        ? "pos"
        : input.positiveIsGood && delta < 0
          ? "neg"
          : delta < 0
            ? "pos"
            : "neg";

    const pointsHtml = series
      .map((point, index) => {
        if (point.date !== this.activeDate) return "";
        return `<circle cx="${x(index).toFixed(2)}" cy="${y(point.value).toFixed(2)}" r="4.5" class="chart-point-active" />`;
      })
      .join("");

    this.updateHTML(
      id,
      `
      <div class="chart-meta">
        <div>
          <div class="chart-label">${escapeHtml(input.yAxisLabel)}</div>
          <div class="chart-value ${latest.value >= 0 ? "pos" : "neg"}">${escapeHtml(input.formatter(latest.value))}</div>
        </div>
        <div>
          <div class="chart-label">前日差分</div>
          <div class="chart-value ${trendClass}">${escapeHtml(input.formatter(delta))}</div>
        </div>
        <div>
          <div class="chart-label">選択日</div>
          <div class="chart-value">${escapeHtml(active ? input.formatter(active.value) : "--")}</div>
        </div>
      </div>
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(input.yAxisLabel)} chart">
        <line x1="${left}" y1="${y(max).toFixed(2)}" x2="${width - right}" y2="${y(max).toFixed(2)}" class="chart-grid-line" />
        <line x1="${left}" y1="${y(axisMid).toFixed(2)}" x2="${width - right}" y2="${y(axisMid).toFixed(2)}" class="chart-grid-line mid" />
        <line x1="${left}" y1="${y(min).toFixed(2)}" x2="${width - right}" y2="${y(min).toFixed(2)}" class="chart-grid-line" />
        <path d="${areaPath}" class="chart-area" />
        <polyline points="${polyline}" class="chart-line" />
        ${pointsHtml}
      </svg>
      <div class="chart-axis">
        <span>${escapeHtml(series[0] ? formatDate(series[0].date) : "")}</span>
        <span>${escapeHtml(formatDate(series.at(-1)?.date ?? ""))}</span>
      </div>
      `,
    );
  }

  private renderFlowChart(report: DailyReport) {
    const analysis = report.analysis ?? [];
    const signals = {
      buy: 0,
      sell: 0,
      hold: 0,
    };

    for (const row of analysis) {
      const normalized = this.normalizeSignal(row.signal);
      if (normalized === "buy") signals.buy += 1;
      if (normalized === "sell") signals.sell += 1;
      if (normalized === "hold") signals.hold += 1;
    }

    const orders = report.execution?.orders ?? [];
    const executed = {
      buy: 0,
      sell: 0,
      buyNotional: 0,
      sellNotional: 0,
    };
    for (const order of orders) {
      const side = this.normalizeSignal(order.side);
      if (side === "buy") {
        executed.buy += 1;
        executed.buyNotional += pickNumber(order.notional);
      } else if (side === "sell") {
        executed.sell += 1;
        executed.sellNotional += pickNumber(order.notional);
      }
    }

    const signalTotal = Math.max(1, signals.buy + signals.sell + signals.hold);
    const maxNotional = Math.max(
      1,
      executed.buyNotional,
      executed.sellNotional,
      executed.buyNotional + executed.sellNotional,
    );

    this.updateHTML(
      "flow-chart",
      `
      <div class="flow-grid">
        <div class="flow-card">
          <div class="flow-head">
            <span>Signals</span>
            <span class="flow-total">${signals.buy + signals.sell + signals.hold} symbols</span>
          </div>
          ${this.renderFlowRow("BUY", signals.buy, signalTotal, "buy")}
          ${this.renderFlowRow("SELL", signals.sell, signalTotal, "sell")}
          ${this.renderFlowRow("HOLD", signals.hold, signalTotal, "hold")}
        </div>
        <div class="flow-card">
          <div class="flow-head">
            <span>Executed Orders</span>
            <span class="flow-total">${orders.length} orders</span>
          </div>
          ${this.renderFlowRow("BUY Notional", executed.buyNotional, maxNotional, "buy", true)}
          ${this.renderFlowRow("SELL Notional", executed.sellNotional, maxNotional, "sell", true)}
          <div class="flow-order-meta">
            BUY ${executed.buy}件 / SELL ${executed.sell}件
          </div>
        </div>
      </div>
      `,
    );
  }

  private renderFlowRow(
    label: string,
    value: number,
    total: number,
    kind: "buy" | "sell" | "hold",
    notional = false,
  ): string {
    const width = clamp01(value / total) * 100;
    const display = notional ? `${formatCompact(value)} JPY` : `${value}`;
    return `
      <div class="flow-row">
        <span class="flow-label">${escapeHtml(label)}</span>
        <div class="flow-track">
          <div class="flow-bar ${kind}" style="width:${width.toFixed(1)}%"></div>
        </div>
        <span class="flow-value">${escapeHtml(display)}</span>
      </div>
    `;
  }

  private normalizeSignal(signal: string | undefined): "buy" | "sell" | "hold" {
    const normalized = (signal ?? "").toUpperCase();
    if (
      normalized.includes("BUY") ||
      normalized.includes("LONG") ||
      normalized.includes("ENTRY") ||
      normalized === "2"
    ) {
      return "buy";
    }
    if (
      normalized.includes("SELL") ||
      normalized.includes("SHORT") ||
      normalized.includes("EXIT") ||
      normalized === "1"
    ) {
      return "sell";
    }
    return "hold";
  }

  private renderSymbolTable(rows: AnalysisSymbol[]) {
    const sorted = [...rows]
      .sort((a, b) => pickNumber(b.alphaScore) - pickNumber(a.alphaScore))
      .slice(0, 12);

    if (sorted.length === 0) {
      this.updateHTML(
        "symbol-table",
        `<div class="empty">銘柄分析データがありません。</div>`,
      );
      return;
    }

    this.updateHTML(
      "symbol-table",
      `
      <table>
        <thead>
          <tr>
            <th>銘柄</th>
            <th>シグナル</th>
            <th>Alpha</th>
            <th>利益率</th>
            <th>前日リターン</th>
            <th>日中レンジ</th>
            <th>流動性/株</th>
          </tr>
        </thead>
        <tbody>
          ${sorted
            .map((row) => {
              const dailyRet = pickNumber(
                row.factors?.dailyReturn,
                pickNumber(row.factors?.prevDailyReturn),
              );
              return `
                <tr>
                  <td><strong>${escapeHtml(row.symbol)}</strong></td>
                  <td><span class="chip ${this.chipClass(row.signal ?? "N/A")}">${escapeHtml(row.signal ?? "N/A")}</span></td>
                  <td>${pickNumber(row.alphaScore).toFixed(3)}</td>
                  <td>${formatPercent(pickNumber(row.finance?.profitMargin))}</td>
                  <td class="${dailyRet >= 0 ? "pos" : "neg"}">${formatSignedPercent(dailyRet)}</td>
                  <td>${formatPercent(pickNumber(row.factors?.intradayRange))}</td>
                  <td>${formatCompact(pickNumber(row.factors?.liquidityPerShare))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `,
    );
  }

  private renderStageTable(unified: UnifiedLogPayload | null) {
    if (!unified?.stages || unified.stages.length === 0) {
      this.updateHTML(
        "stage-table",
        `<div class="empty">検証ステージログが見つかりません。</div>`,
      );
      return;
    }

    this.updateHTML(
      "stage-table",
      `
      <table>
        <thead>
          <tr>
            <th>ステージ</th>
            <th>状態</th>
            <th>主要メトリクス</th>
          </tr>
        </thead>
        <tbody>
          ${unified.stages
            .map((stage) => {
              const metric = Object.entries(stage.metrics ?? {}).at(0);
              const metricLabel = metric
                ? `${metric[0]}: ${typeof metric[1] === "number" ? metric[1].toFixed(3) : metric[1]}`
                : "-";
              return `
                <tr>
                  <td>${escapeHtml(stage.name ?? "Unknown")}</td>
                  <td><span class="chip ${this.chipClass(stage.status ?? "UNKNOWN")}">${escapeHtml(stage.status ?? "UNKNOWN")}</span></td>
                  <td>${escapeHtml(metricLabel)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `,
    );
  }

  private renderBenchmark(payload: BenchmarkLogPayload | null) {
    if (!payload?.report?.analyst?.baselines) {
      this.updateHTML(
        "benchmark-table",
        `<div class="empty">同日ベンチマークがありません。</div>`,
      );
      this.updateHTML("benchmark-quick", `<div class="empty">ベンチなし</div>`);
      return;
    }

    const baselines = [...payload.report.analyst.baselines].sort(
      (a, b) => pickNumber(a.metrics.rmse) - pickNumber(b.metrics.rmse),
    );
    const best = baselines[0];

    this.updateHTML(
      "benchmark-quick",
      `
      <div class="quick-title">最良モデル</div>
      <div class="quick-name">${escapeHtml(best?.name ?? "N/A")}</div>
      <div class="quick-metric">RMSE ${pickNumber(best?.metrics.rmse).toFixed(3)}</div>
      <div class="quick-insight">${escapeHtml(payload.report.analyst.insights ?? "インサイト未記録")}</div>
    `,
    );

    this.updateHTML(
      "benchmark-table",
      `
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>MAE</th>
            <th>RMSE</th>
            <th>sMAPE</th>
            <th>DirAcc</th>
          </tr>
        </thead>
        <tbody>
          ${baselines
            .slice(0, 8)
            .map(
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.name)}</strong></td>
                  <td>${pickNumber(row.metrics.mae).toFixed(3)}</td>
                  <td>${pickNumber(row.metrics.rmse).toFixed(3)}</td>
                  <td>${pickNumber(row.metrics.smape).toFixed(3)}%</td>
                  <td class="${pickNumber(row.metrics.directionalAccuracy) >= 50 ? "pos" : "neg"}">${pickNumber(row.metrics.directionalAccuracy).toFixed(1)}%</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `,
    );
  }

  private renderAlphaDiscovery(payload: AlphaDiscoveryPayload | null) {
    if (!payload?.candidates || payload.candidates.length === 0) {
      this.updateHTML(
        "alpha-discovery",
        `<div class="empty">直行アルファ探索ログは未検出です。</div>`,
      );
      return;
    }

    const selected = payload.selected ?? [];
    const candidates = [...payload.candidates].sort(
      (a, b) => pickNumber(b.score) - pickNumber(a.score),
    );

    this.updateHTML(
      "alpha-discovery",
      `
      <div class="alpha-top">
        <div class="alpha-selected">
          ${selected.length > 0 ? selected.map((id) => `<span class="chip ready">${escapeHtml(id)}</span>`).join("") : '<span class="chip caution">採択なし</span>'}
        </div>
        <div class="alpha-meta">sample ${pickNumber(payload.evidence?.sampleSize, 0)} / positive ratio ${formatPercent(pickNumber(payload.evidence?.positiveReturnRatio, 0), 1)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>候補</th>
            <th>Score</th>
            <th>IC proxy</th>
            <th>直行性</th>
            <th>相関</th>
          </tr>
        </thead>
        <tbody>
          ${candidates
            .slice(0, 6)
            .map(
              (candidate) => `
              <tr>
                <td title="${escapeHtml(candidate.reasoning ?? "")}">${escapeHtml(candidate.id)}</td>
                <td>${pickNumber(candidate.score).toFixed(3)}</td>
                <td>${pickNumber(candidate.icProxy).toFixed(3)}</td>
                <td>${pickNumber(candidate.orthogonality).toFixed(2)}</td>
                <td>${pickNumber(candidate.correlationToBaseline).toFixed(3)}</td>
              </tr>
            `,
            )
            .join("")}
        </tbody>
      </table>
    `,
    );
  }

  private computeConfidence(
    report: DailyReport,
    readiness: ReadinessLogPayload | null,
  ): number {
    const evidencePassCount = [
      report.evidence?.estat?.status,
      report.evidence?.jquants?.status,
      report.results?.status,
    ].filter((status) => status === "PASS").length;

    const readinessScore = pickNumber(readiness?.report?.score?.total) / 100;
    const edgeScore = clamp01(pickNumber(report.results?.expectedEdge) / 0.25);
    const returnScore = clamp01(
      (pickNumber(report.results?.basketDailyReturn) + 0.03) / 0.06,
    );
    const evidenceScore = clamp01(evidencePassCount / 3);

    return clamp01(
      edgeScore * 0.35 +
        returnScore * 0.25 +
        evidenceScore * 0.25 +
        readinessScore * 0.15,
    );
  }

  private pickBenchmark(date: string): BenchmarkLogPayload | null {
    const byDate = this.benchmarkByDate.get(date);
    if (byDate) return byDate;

    const latestDate = Array.from(this.benchmarkByDate.keys()).sort((a, b) =>
      b.localeCompare(a),
    )[0];
    return latestDate ? (this.benchmarkByDate.get(latestDate) ?? null) : null;
  }

  private pickReadiness(date: string): ReadinessLogPayload | null {
    const byDate = this.readinessByDate.get(date);
    if (byDate) return byDate;

    const latestDate = Array.from(this.readinessByDate.keys()).sort((a, b) =>
      b.localeCompare(a),
    )[0];
    return latestDate ? (this.readinessByDate.get(latestDate) ?? null) : null;
  }

  private pickAlphaDiscovery(date: string): AlphaDiscoveryPayload | null {
    const byDate = this.alphaByDate.get(date);
    if (byDate && byDate.length > 0) {
      return (
        byDate.sort((a, b) => {
          const at = new Date(a.endedAt ?? a.startedAt ?? 0).getTime();
          const bt = new Date(b.endedAt ?? b.startedAt ?? 0).getTime();
          return bt - at;
        })[0] ?? null
      );
    }

    const all = Array.from(this.alphaByDate.values()).flat();
    if (all.length === 0) return null;

    return (
      all.sort((a, b) => {
        const at = new Date(a.endedAt ?? a.startedAt ?? 0).getTime();
        const bt = new Date(b.endedAt ?? b.startedAt ?? 0).getTime();
        return bt - at;
      })[0] ?? null
    );
  }

  private renderKpi(id: string, value: string, signal: number) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove("pos", "neg");
    if (signal > 0) {
      el.classList.add("pos");
    }
    if (signal < 0) {
      el.classList.add("neg");
    }
  }

  private renderEmptyState() {
    this.updateText("current-date", "--");
    this.updateText("hero-title", "UQTL // ログを選択してください");
    this.updateText("hero-subtitle", "データ未選択");
    this.updateText("posture-chip", "待機中");
    this.updateText("entropy-chip", "Entropy --");
    this.updateText(
      "hero-reason",
      "左側のタイムラインから日付を選ぶと表示されます。",
    );
    this.updateText("confidence-label", "0 / 100");
    this.updateText("integrity-indicator", "証拠整合性: --");
    const bar = document.getElementById("confidence-bar");
    if (bar) bar.setAttribute("style", "width:0%");
    const entropyChip = document.getElementById("entropy-chip");
    entropyChip?.classList.remove("ready", "caution", "risk");
    entropyChip?.classList.add("neutral");
    this.updateHTML("symbol-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("stage-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("benchmark-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("benchmark-quick", `<div class="empty">データ未選択</div>`);
    this.updateHTML("alpha-discovery", `<div class="empty">データ未選択</div>`);
    this.updateHTML("uqtl-stream", `<div class="empty">データ未選択</div>`);
    this.updateHTML(
      "evidence-bonding",
      `<div class="empty">データ未選択</div>`,
    );
    this.updateHTML("dag-map", `<div class="empty">データ未選択</div>`);
    this.updateHTML("return-chart", `<div class="empty">データ未選択</div>`);
    this.updateHTML("alpha-chart", `<div class="empty">データ未選択</div>`);
    this.updateHTML("flow-chart", `<div class="empty">データ未選択</div>`);
    this.updateHTML("thesis-block", `<div class="empty">データ未選択</div>`);
    this.updateHTML("raw-json", `<pre>{}</pre>`);
  }

  private chipClass(status: string): string {
    const normalized = status.toUpperCase();
    if (
      normalized.includes("PASS") ||
      normalized.includes("READY") ||
      normalized.includes("USEFUL") ||
      normalized.includes("APPROVE") ||
      normalized.includes("LONG") ||
      normalized.includes("維持") ||
      normalized.includes("許容")
    ) {
      return "ready";
    }
    if (
      normalized.includes("CAUTION") ||
      normalized.includes("WATCH") ||
      normalized.includes("中立") ||
      normalized.includes("様子見")
    ) {
      return "caution";
    }
    if (
      normalized.includes("FAIL") ||
      normalized.includes("ERROR") ||
      normalized.includes("SHORT") ||
      normalized.includes("防御") ||
      normalized.includes("縮小")
    ) {
      return "risk";
    }
    return "neutral";
  }

  private updateText(id: string, text: string) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  private updateHTML(id: string, html: string) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
}

new InvestorDashboard();
