(() => {
  'use strict';

  const queues = ['attention', 'oos', 'review', 'rejected'];
  const state = { payload: null, query: '', stateFilter: 'all', queueFilter: 'all', freshness: 'all' };
  const byId = id => document.getElementById(id);
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);
  const asArray = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const pick = (object, ...keys) => keys.map(key => object?.[key]).find(value => value !== undefined && value !== null && value !== '');
  const text = (object, ...keys) => String(pick(object, ...keys) ?? '—');
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ja');
  const boolean = value => value === true || value === 'true' || value === 'pass' || value === 'passed' || value === 'eligible';

  function hypothesisRecords(payload) {
    const candidates = [payload?.hypotheses, payload?.evidence?.hypotheses, payload?.research?.hypotheses, payload?.registry?.hypotheses];
    const found = candidates.find(Array.isArray);
    return found || [];
  }

  function runRecords(payload) {
    const candidates = [payload?.runs, payload?.evidence?.runs, payload?.research?.runs, payload?.executions, payload?.operational?.runs];
    const found = candidates.find(Array.isArray);
    return found || [];
  }

  function gateResults(record) {
    const raw = pick(record, 'gate_results', 'gates', 'checks', 'promotion_gates', 'requirements');
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.entries(raw).map(([name, value]) => typeof value === 'object' ? { name, ...value } : { name, status: value });
    return [];
  }

  function missingConditions(record) {
    const explicit = asArray(pick(record, 'missing_evidence', 'unmet_conditions', 'missing_conditions', 'blockers', 'open_issues')).filter(Boolean);
    if (explicit.length) return explicit.map(value => typeof value === 'object' ? text(value, 'message', 'name', 'reason', 'status') : String(value));
    return gateResults(record).filter(gate => !boolean(pick(gate, 'passed', 'eligible', 'status', 'result'))).map(gate => text(gate, 'message', 'name', 'gate', 'reason'));
  }

  function recordState(record) {
    return normalize(pick(record, 'state', 'status', 'decision', 'lifecycle_state', 'stage')) || 'unknown';
  }

  function queueFor(record) {
    const current = recordState(record);
    const missing = missingConditions(record);
    const oos = pick(record, 'oos_status', 'frozen_oos', 'formal_evaluation', 'evaluation_status');
    const eligible = pick(record, 'eligible_for_review', 'review_ready', 'promotion_eligible');
    if (/(reject|retir|stop|fail|invalid|killed)/.test(current)) return 'rejected';
    if (boolean(eligible) || /(review|candidate|eligible|promotable|technical_ready)/.test(current)) return 'review';
    if (/(oos|frozen|awaiting_evaluation|registered|backtest)/.test(current) || oos === false || normalize(oos).includes('pending')) return 'oos';
    if (missing.length || /(attention|stale|partial|error|blocked|unknown)/.test(current)) return 'attention';
    return 'attention';
  }

  function freshnessFor(record) {
    const explicit = normalize(pick(record, 'freshness', 'data_freshness', 'evidence_freshness'));
    if (/(stale|expired|old|unknown|missing)/.test(explicit)) return 'stale';
    const asOf = pick(record, 'data_as_of', 'as_of', 'data_timestamp', 'updated_at');
    if (!asOf) return 'stale';
    const timestamp = Date.parse(asOf);
    if (!Number.isFinite(timestamp)) return 'current';
    return Date.now() - timestamp > 1000 * 60 * 60 * 24 * 30 ? 'stale' : 'current';
  }

  function nextGate(record) {
    const explicit = pick(record, 'next_gate', 'next_action', 'required_next_gate', 'promotion_gate');
    if (explicit) return typeof explicit === 'object' ? text(explicit, 'name', 'message', 'status') : String(explicit);
    const failed = gateResults(record).find(gate => !boolean(pick(gate, 'passed', 'eligible', 'status', 'result')));
    return failed ? text(failed, 'name', 'gate', 'message') : '人間レビュー';
  }

  function evidenceLinks(record) {
    const raw = asArray(pick(record, 'evidence', 'evidence_links', 'artifacts', 'sources', 'reports'));
    return raw.map((entry, index) => {
      if (typeof entry === 'string') return { label: `証拠 ${index + 1}`, href: entry };
      return { label: text(entry, 'label', 'title', 'name', 'type', 'path'), href: pick(entry, 'url', 'href', 'path') };
    });
  }

  function falsifiers(record) {
    return asArray(pick(record, 'falsifiers', 'falsification_conditions', 'failure_conditions', 'reject_conditions')).map(value => typeof value === 'object' ? text(value, 'message', 'name', 'condition') : String(value));
  }

  function displayName(record, index) {
    return text(record, 'hypothesis_name', 'name', 'title', 'hypothesis_id', 'id') === '—' ? `仮説 ${index + 1}` : text(record, 'hypothesis_name', 'name', 'title', 'hypothesis_id', 'id');
  }

  function normalizedRecord(record, index) {
    const missing = missingConditions(record);
    const evidence = evidenceLinks(record);
    return {
      raw: record,
      id: text(record, 'hypothesis_id', 'id', 'slug', 'name'),
      name: displayName(record, index),
      summary: text(record, 'summary', 'description', 'thesis', 'question', 'rationale'),
      state: recordState(record),
      queue: queueFor(record),
      freshness: freshnessFor(record),
      nextGate: nextGate(record),
      missing,
      lastRun: text(record, 'last_run_id', 'run_id', 'latest_run', 'last_executed_at', 'updated_at'),
      dataAsOf: text(record, 'data_as_of', 'as_of', 'data_timestamp', 'updated_at'),
      oos: text(record, 'oos_status', 'frozen_oos', 'formal_evaluation', 'evaluation_status'),
      risk: text(record, 'risk', 'risk_status', 'max_drawdown', 'warning', 'warnings'),
      command: text(record, 'reproduction_command', 'reproduce_command', 'command', 'run_command'),
      evidence,
      falsifiers: falsifiers(record),
    };
  }

  function searchable(record) {
    return normalize([record.name, record.summary, record.state, record.nextGate, record.missing.join(' '), record.lastRun, record.dataAsOf, record.risk, record.command, record.evidence.map(item => item.label).join(' ')].join(' '));
  }

  function filteredRecords() {
    const query = normalize(state.query.trim());
    return state.records.filter(record => {
      const matchesQuery = !query || searchable(record).includes(query);
      const matchesState = state.stateFilter === 'all' || record.state === state.stateFilter;
      const matchesQueue = state.queueFilter === 'all' || record.queue === state.queueFilter;
      const matchesFreshness = state.freshness === 'all' || record.freshness === state.freshness;
      return matchesQuery && matchesState && matchesQueue && matchesFreshness;
    });
  }

  function renderCard(record) {
    const template = byId('hypothesis-template');
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.hypothesis = record.id;
    card.querySelector('.queue-badge').textContent = queueLabel(record.queue);
    card.querySelector('.state-badge').textContent = record.state || 'unknown';
    card.querySelector('h3').textContent = record.name;
    card.querySelector('.hypothesis-summary').textContent = record.summary;
    card.querySelector('[data-field="next-gate"]').textContent = record.nextGate;
    card.querySelector('[data-field="missing"]').textContent = record.missing.length ? record.missing.join(' / ') : 'なし';
    card.querySelector('[data-field="last-run"]').textContent = record.lastRun;
    card.querySelector('[data-field="data-as-of"]').textContent = record.dataAsOf;
    card.querySelector('[data-field="oos"]').textContent = record.oos;
    card.querySelector('[data-field="risk"]').textContent = record.risk;
    card.querySelector('[data-field="command"]').textContent = record.command;
    card.querySelector('[data-field="evidence"]').innerHTML = record.evidence.length ? record.evidence.map(item => item.href ? `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)} ↗</a></li>` : `<li>${escapeHtml(item.label)}</li>`).join('') : '<li>証拠リンクなし</li>';
    card.querySelector('[data-field="falsifiers"]').innerHTML = record.falsifiers.length ? record.falsifiers.map(item => `<li>${escapeHtml(item)}</li>`).join('') : '<li>未登録</li>';
    return card;
  }

  function queueLabel(queue) {
    return { attention: '要対応', oos: 'OOS待ち', review: 'レビュー可能', rejected: '棄却・停止' }[queue] || queue;
  }

  function renderQueues() {
    const records = filteredRecords();
    queues.forEach(queue => {
      const queueRecords = records.filter(record => record.queue === queue);
      const grid = document.querySelector(`[data-queue-grid="${queue}"]`);
      const section = document.querySelector(`[data-queue-section="${queue}"]`);
      const count = document.querySelector(`[data-queue-count="${queue}"]`);
      grid.replaceChildren(...queueRecords.map(renderCard));
      if (!queueRecords.length) grid.innerHTML = '<div class="empty">該当する仮説はありません。</div>';
      count.textContent = `${queueRecords.length}件`;
      section.hidden = state.queueFilter !== 'all' && state.queueFilter !== queue;
      byId(`metric-${queue}`).textContent = state.records.filter(record => record.queue === queue).length;
    });
    byId('result-summary').textContent = `${records.length}件 / 全${state.records.length}件`;
    writeUrl();
  }

  function populateStateOptions() {
    const select = byId('state-filter');
    [...new Set(state.records.map(record => record.state))].sort().forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
    });
  }

  function renderRisks(payload) {
    const raw = asArray(pick(payload, 'risks', 'warnings', 'operational_risks', 'evidence_issues', 'alerts'));
    const defaults = [
      { title: '実績と研究を分離', description: 'BacktestやPaperをLive実績として表示しません。' },
      { title: '費用と最大DDを先に確認', description: '収益率より期間・比較対象・費用・最大ドローダウンを優先します。' },
      { title: '古い証拠を正常扱いしない', description: 'データ時点や実行IDがない仮説は要対応へ分類します。' },
    ];
    const risks = raw.length ? raw.map((item, index) => typeof item === 'object' ? { title: text(item, 'title', 'name', 'type') === '—' ? `リスク ${index + 1}` : text(item, 'title', 'name', 'type'), description: text(item, 'message', 'description', 'reason', 'status') } : { title: `リスク ${index + 1}`, description: String(item) }) : defaults;
    byId('risk-grid').innerHTML = risks.slice(0, 9).map(item => `<article class="risk-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></article>`).join('');
  }

  function renderRuns(payload) {
    const runs = runRecords(payload).slice(0, 30);
    byId('run-table').innerHTML = runs.length ? `<table><caption>最新30件の実行と証拠状態</caption><thead><tr><th>実行ID</th><th>仮説</th><th>状態</th><th>データ時点</th><th>コード</th><th>証拠</th></tr></thead><tbody>${runs.map(run => `<tr><td><strong>${escapeHtml(text(run,'run_id','id'))}</strong><small>${escapeHtml(text(run,'started_at','created_at','updated_at'))}</small></td><td>${escapeHtml(text(run,'hypothesis_name','hypothesis_id','name'))}</td><td>${escapeHtml(text(run,'status','state','result'))}</td><td>${escapeHtml(text(run,'data_as_of','as_of','data_version'))}</td><td>${escapeHtml(text(run,'code_sha','commit_sha','revision'))}</td><td>${evidenceLinks(run).length}件</td></tr>`).join('')}</tbody></table>` : '<div class="empty">実行証拠がありません。</div>';
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.query = params.get('q') || '';
    state.stateFilter = params.get('state') || 'all';
    state.queueFilter = params.get('queue') || 'all';
    state.freshness = params.get('freshness') || 'all';
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.stateFilter !== 'all') params.set('state', state.stateFilter);
    if (state.queueFilter !== 'all') params.set('queue', state.queueFilter);
    if (state.freshness !== 'all') params.set('freshness', state.freshness);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  }

  function bindControls() {
    byId('query').value = state.query;
    byId('state-filter').value = state.stateFilter;
    byId('queue-filter').value = state.queueFilter;
    byId('freshness-filter').value = state.freshness;
    byId('query').addEventListener('input', event => { state.query = event.target.value; renderQueues(); });
    byId('state-filter').addEventListener('change', event => { state.stateFilter = event.target.value; renderQueues(); });
    byId('queue-filter').addEventListener('change', event => { state.queueFilter = event.target.value; renderQueues(); });
    byId('freshness-filter').addEventListener('change', event => { state.freshness = event.target.value; renderQueues(); });
    byId('clear-filters').addEventListener('click', () => { state.query='';state.stateFilter='all';state.queueFilter='all';state.freshness='all';bindValues();renderQueues();byId('query').focus(); });
    window.addEventListener('popstate', () => { readUrl(); bindValues(); renderQueues(); });
  }

  function bindValues() {
    byId('query').value = state.query;
    byId('state-filter').value = state.stateFilter;
    byId('queue-filter').value = state.queueFilter;
    byId('freshness-filter').value = state.freshness;
  }

  async function load() {
    readUrl();
    try {
      const response = await fetch('/api/evidence', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.payload = payload;
      state.records = hypothesisRecords(payload).map(normalizedRecord);
      byId('system-state').textContent = text(payload, 'system_state', 'evidence_status', 'status');
      byId('as-of').textContent = `基準日時 ${text(payload, 'as_of', 'generated_at', 'updated_at')}`;
      byId('system-message').textContent = state.records.length ? `${state.records.length}件の仮説を評価しました。` : '仮説レジストリに公開可能な項目がありません。';
      populateStateOptions();
      bindControls();
      renderQueues();
      renderRisks(payload);
      renderRuns(payload);
    } catch (error) {
      byId('system-state').textContent = 'API ERROR';
      byId('system-message').textContent = `Evidence APIを読み込めません: ${error.message}`;
      state.records = [];
      bindControls();
      renderQueues();
      renderRisks({});
      renderRuns({});
    }
  }

  load();
})();
