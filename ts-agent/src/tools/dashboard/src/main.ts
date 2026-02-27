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

interface PersonaAction {
  audience: string;
  posture: string;
  action: string;
  rationale: string;
}

const DAILY_BASE = "./logs/daily";
const BENCH_BASE = "./logs/benchmarks";
const UNIFIED_BASE = "./logs/unified";
const READINESS_BASE = "./logs/readiness";

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

const fetchJson = async <T>(path: string): Promise<T | null> => {
  try {
    const res = await fetch(path, { cache: "no-store" });
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

  private timeline: string[] = [];

  private activeDate = "";

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap() {
    this.bindEvents();
    await this.refresh();
    window.setInterval(() => {
      void this.refresh();
    }, 30000);
  }

  private bindEvents() {
    const refreshButton = document.getElementById("refresh-btn");
    refreshButton?.addEventListener("click", () => {
      void this.refresh();
    });
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
    const manifest = await fetchJson<string[]>(`${DAILY_BASE}/manifest.json`);
    if (!manifest) return;

    const files = manifest.filter((file) => file.endsWith(".json")).sort();
    const nextDailyMap = new Map<string, DailyLogEnvelope>();
    const stems = new Set<string>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await fetchJson<DailyLogEnvelope>(
          `${DAILY_BASE}/${file}`,
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

    for (const date of this.timeline) {
      candidates.add(date);
    }
    for (const stem of stems) {
      candidates.add(stem);
    }

    await Promise.all(
      Array.from(candidates).map(async (stem) => {
        const payload = await fetchJson<ReadinessLogPayload>(
          `${READINESS_BASE}/${stem}.json`,
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
    const manifest = await fetchJson<string[]>(`${BENCH_BASE}/manifest.json`);
    if (!manifest) return;

    const files = manifest.filter((file) => file.endsWith(".json"));
    const nextBenchMap = new Map<string, BenchmarkLogPayload>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await fetchJson<BenchmarkLogPayload>(
          `${BENCH_BASE}/${file}`,
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
    const manifest = await fetchJson<string[]>(`${UNIFIED_BASE}/manifest.json`);
    if (!manifest) return;

    const files = manifest.filter((file) => file.endsWith(".json"));
    const nextUnifiedMap = new Map<string, UnifiedLogPayload>();
    const nextAlphaByDate = new Map<string, AlphaDiscoveryPayload[]>();

    await Promise.all(
      files.map(async (file) => {
        const payload = await fetchJson<Record<string, unknown>>(
          `${UNIFIED_BASE}/${file}`,
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

    const posture =
      confidence >= 0.75 ? "攻め寄り" : confidence >= 0.5 ? "中立" : "守り寄り";

    this.updateText("current-date", formatDate(this.activeDate));
    this.updateText(
      "hero-title",
      report.decision?.action ?? "次のアクション判定を計算中",
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

    this.renderKpi("kpi-edge", formatPercent(expectedEdge), expectedEdge);
    this.renderKpi("kpi-return", formatSignedPercent(dailyReturn), dailyReturn);
    this.renderKpi("kpi-kelly", formatPercent(kelly), kelly - 0.1);
    this.renderKpi("kpi-stop", formatPercent(stopLoss), -stopLoss);
    this.renderKpi("kpi-symbol", report.decision?.topSymbol ?? "--", 0);
    this.renderKpi("kpi-liquidity", formatCompact(avgLiquidity), avgLiquidity);

    this.renderDataHealth(report, readiness, maxPositions);
    this.renderPersonaActions(
      this.buildPersonaActions({
        expectedEdge,
        dailyReturn,
        stopLoss,
        maxPositions,
        avgProfitMargin,
        avgRange,
        topSymbol: report.decision?.topSymbol ?? "--",
      }),
    );
    this.renderSymbolTable(analysis);
    this.renderStageTable(unified);
    this.renderBenchmark(benchmark);
    this.renderAlphaDiscovery(alpha);

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

    this.updateHTML(
      "data-health",
      evidenceItems
        .map(
          (item) => `
            <div class="health-row">
              <span>${escapeHtml(item.label)}</span>
              <span class="chip ${this.chipClass(item.status)}">${escapeHtml(item.status)}</span>
            </div>
          `,
        )
        .join(""),
    );
  }

  private buildPersonaActions(input: {
    expectedEdge: number;
    dailyReturn: number;
    stopLoss: number;
    maxPositions: number;
    avgProfitMargin: number;
    avgRange: number;
    topSymbol: string;
  }): PersonaAction[] {
    const longTerm: PersonaAction =
      input.expectedEdge > 0.12 && input.avgProfitMargin > 0.08
        ? {
            audience: "長期投資家",
            posture: "積極維持",
            action:
              "既存コアを維持しつつ、トップ銘柄の比率を段階的に引き上げる。",
            rationale:
              "収益性と期待エッジが同時にプラス。短期ノイズより継続性を優先できる局面。",
          }
        : {
            audience: "長期投資家",
            posture: "防御重視",
            action: "新規一括投資を避け、定期積立のみ継続する。",
            rationale:
              "エッジが弱いため、時間分散でエントリーコストを平準化する方が合理的。",
          };

    const swing: PersonaAction =
      input.dailyReturn >= 0 && input.avgRange >= 0.01
        ? {
            audience: "スイング投資家",
            posture: "トレンド追随",
            action: `${input.topSymbol} を軸に短期順張り。逆指値を ${formatPercent(input.stopLoss)} で固定。`,
            rationale:
              "当日リターンとボラティリティが両立しており、機動的な回転に向く。",
          }
        : {
            audience: "スイング投資家",
            posture: "様子見",
            action: "新規建てを最小化し、翌営業日の値動き確認後に再判定する。",
            rationale: "方向感が弱く、損益比が崩れやすい局面。",
          };

    const riskAware: PersonaAction =
      input.maxPositions <= 5 && input.stopLoss <= 0.03
        ? {
            audience: "リスク重視投資家",
            posture: "許容範囲",
            action: "分散数を維持しつつ、1銘柄あたりの投入額を固定する。",
            rationale:
              "ポジション上限と損切り幅が明確で、最大損失の見通しが立てやすい。",
          }
        : {
            audience: "リスク重視投資家",
            posture: "縮小",
            action: "資金配分を半分に抑え、ドローダウン監視を優先する。",
            rationale:
              "保護ラインが広めで、急変時の損失許容が大きくなりやすい。",
          };

    return [longTerm, swing, riskAware];
  }

  private renderPersonaActions(actions: PersonaAction[]) {
    this.updateHTML(
      "persona-actions",
      actions
        .map(
          (item, index) => `
            <article class="persona-card" style="--delay:${index * 80}ms">
              <div class="persona-head">
                <h3>${escapeHtml(item.audience)}</h3>
                <span class="chip ${this.chipClass(item.posture)}">${escapeHtml(item.posture)}</span>
              </div>
              <p class="persona-action">${escapeHtml(item.action)}</p>
              <p class="persona-rationale">${escapeHtml(item.rationale)}</p>
            </article>
          `,
        )
        .join(""),
    );
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
      return byDate.sort((a, b) => {
        const at = new Date(a.endedAt ?? a.startedAt ?? 0).getTime();
        const bt = new Date(b.endedAt ?? b.startedAt ?? 0).getTime();
        return bt - at;
      })[0];
    }

    const all = Array.from(this.alphaByDate.values()).flat();
    if (all.length === 0) return null;

    return all.sort((a, b) => {
      const at = new Date(a.endedAt ?? a.startedAt ?? 0).getTime();
      const bt = new Date(b.endedAt ?? b.startedAt ?? 0).getTime();
      return bt - at;
    })[0];
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
    this.updateText("hero-title", "ログを選択してください");
    this.updateText("hero-subtitle", "データ未選択");
    this.updateText("posture-chip", "待機中");
    this.updateText(
      "hero-reason",
      "左側のタイムラインから日付を選ぶと表示されます。",
    );
    this.updateText("confidence-label", "0 / 100");
    const bar = document.getElementById("confidence-bar");
    if (bar) bar.setAttribute("style", "width:0%");
    this.updateHTML("symbol-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("stage-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("benchmark-table", `<div class="empty">データ未選択</div>`);
    this.updateHTML("benchmark-quick", `<div class="empty">データ未選択</div>`);
    this.updateHTML("alpha-discovery", `<div class="empty">データ未選択</div>`);
    this.updateHTML("persona-actions", `<div class="empty">データ未選択</div>`);
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
