// Read-only operations monitor. Credentials stay in the request context, never in snapshots.
export function createMonitorController({ readContext, onState, fetchImpl = fetch,
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  intervalMs = 15000, timeoutMs = 8000 } = {}) {
  const paths = { dispatch: '/api/health', workers: '/api/admin/workers', queue: '/api/admin/overview' };
  const empty = () => ({ status: 'unknown', data: null, lastSuccessAt: null });
  let sections = { dispatch: empty(), workers: empty(), queue: empty() };
  let active = false, generation = 0, timer, pending, observedContext;
  const aborters = new Set();
  const contextMatches = () => {
    const current = readContext();
    return current?.allowed === true && current.token === observedContext?.token
      && current.identity === observedContext?.identity && current.base === observedContext?.base;
  };
  const emit = () => onState({ active, refreshing: Boolean(pending), observedAt: now(), sections: structuredClone(sections) });
  function stop(reason = 'paused') {
    active = false; generation++; cancel(timer); timer = undefined;
    for (const controller of aborters) controller.abort();
    aborters.clear(); pending = null; observedContext = null;
    sections = Object.fromEntries(Object.keys(paths).map(key => [key, { ...empty(), status: reason }]));
    emit();
  }
  async function request(key, context) {
    const controller = new AbortController(); aborters.add(controller);
    let deadline;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(context.base.replace(/\/$/, '') + paths[key], {
            cache: 'no-store', signal: controller.signal,
            headers: key === 'dispatch' ? {} : { Authorization: `Bearer ${context.token}` },
          });
          if (!response.ok) throw Object.assign(new Error('Monitor request failed'), { auth: [401, 403].includes(response.status) });
          const value = await response.json();
          if ((key === 'dispatch' && value?.ok !== true)
            || (key === 'workers' && !Array.isArray(value?.workers))
            || (key === 'queue' && (!value?.jobs || typeof value.jobs !== 'object'))) throw new Error('Invalid monitor response');
          if (key === 'dispatch') return { ok: true };
          if (key === 'queue') return { jobs: Object.fromEntries(['pending', 'processing', 'finalizing'].map(name => [name, value.jobs[name] ?? 0])) };
          return { workers: value.workers.map(worker => Object.fromEntries(
            ['worker_name', 'supported_systems', 'current_job_id', 'state', 'last_seen_at', 'online'].map(name => [name, worker[name]])
          )) };
        })(),
        new Promise((_, reject) => { deadline = schedule(() => { controller.abort(); reject(new Error('Monitor timeout')); }, timeoutMs); }),
      ]);
    } finally { cancel(deadline); aborters.delete(controller); }
  }
  function refresh() {
    if (!active) return Promise.resolve();
    if (!contextMatches()) { stop('unauthorized'); return Promise.resolve(); }
    if (pending) return pending;
    cancel(timer); timer = undefined;
    const version = generation, context = { ...observedContext };
    const work = Promise.all(Object.keys(paths).map(async key => {
      try { return { key, data: await request(key, context) }; }
      catch (error) { return { key, auth: error?.auth === true, failed: true }; }
    })).then(results => {
      if (!active || version !== generation) return;
      if (!contextMatches()) { stop('unauthorized'); return; }
      if (results.some(result => result.auth)) { stop('unauthorized'); return; }
      for (const result of results) {
        const previous = sections[result.key];
        sections[result.key] = result.failed
          ? { ...previous, status: 'error' }
          : { status: 'fresh', data: result.data, lastSuccessAt: now() };
      }
    }).finally(() => {
      if (version !== generation) return;
      pending = null; emit();
      if (active) timer = schedule(refresh, intervalMs);
    });
    pending = work; emit();
    return work;
  }
  function start() {
    stop();
    const context = readContext();
    if (!context?.allowed || !context.token || !context.base) { stop('unauthorized'); return Promise.resolve(); }
    observedContext = { ...context }; active = true;
    sections = Object.fromEntries(Object.keys(paths).map(key => [key, empty()]));
    return refresh();
  }
  const checkAccess = () => { if (active && !contextMatches()) stop('unauthorized'); };
  return { start, refresh, stop, checkAccess };
}

const timeText = value => value ? new Date(value).toLocaleTimeString('zh-TW', { hour12: false }) : '尚無成功更新';
const safeNumber = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
export function workerPresentation(worker, observedAt) {
  const lastSeen = Number(worker.last_seen_at);
  const age = Number.isFinite(lastSeen) && lastSeen > 0 ? Math.max(0, Math.floor(observedAt / 1000 - lastSeen)) : null;
  const recent = age === null ? '尚無回報時間' : age < 60 ? `${age} 秒前` : `${Math.floor(age / 60)} 分鐘前`;
  const online = worker.online === true;
  const busy = Boolean(worker.current_job_id) || ['busy', 'processing', 'finalizing'].includes(worker.state);
  return {
    name: String(worker.worker_name || '未命名主機'),
    status: !online ? '未回報' : busy ? '處理中' : worker.state === 'idle' ? '待命' : '有回報・狀態待確認',
    tone: !online ? 'error' : busy || worker.state !== 'idle' ? 'warning' : 'ok',
    recent, job: String(worker.current_job_id || '—'),
    systems: Array.isArray(worker.supported_systems) ? worker.supported_systems.join('、') : '尚未回報',
  };
}

export function mountMonitor(host, { readContext, dialog, documentRef = document } = {}) {
  const el = (tag, text, className) => {
    const node = documentRef.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  host.replaceChildren();
  const heading = el('div', undefined, 'monitor-heading');
  const title = el('div'); title.append(el('h3', '主機與排單監控'), el('p', '開啟後每 15 秒更新；關閉或切到背景頁面即暫停。', 'monitor-muted'));
  const refreshButton = el('button', '立即更新', 'text-button'); refreshButton.type = 'button';
  heading.append(title, refreshButton);
  const notice = el('p', '正在讀取狀態…', 'monitor-notice'); notice.setAttribute('role', 'status');
  const summary = el('div', undefined, 'monitor-summary');
  const workerArea = el('div', undefined, 'monitor-worker-area');
  const note = el('p', '「未回報」可能是程式停止、維護或網路中斷，不等於主機關機。有回報只代表工作程式仍在聯絡；不保證 GPU、SketchUp 或任務進度正常。', 'monitor-muted');
  host.append(heading, notice, summary, workerArea, note);
  const card = (label, value, tone, detail) => {
    const node = el('div', undefined, 'monitor-card'); node.dataset.tone = tone;
    node.append(el('span', label), el('strong', value), el('small', detail)); return node;
  };
  function render(snapshot) {
    const { dispatch, workers, queue } = snapshot.sections;
    const denied = dispatch.status === 'unauthorized';
    const failed = Object.values(snapshot.sections).some(section => section.status === 'error');
    const initialized = Object.values(snapshot.sections).some(section => section.lastSuccessAt);
    notice.dataset.tone = denied || failed ? 'error' : 'neutral';
    notice.textContent = denied ? '登入或管理員權限已變更，請重新開啟後台。'
      : !snapshot.active ? '監控已暫停，重新開啟後台或返回此頁時會取得最新狀態。'
      : failed ? '部分狀態無法更新；未取得最新資料的區域已標示，請檢查連線或稍後重試。'
      : snapshot.refreshing ? initialized ? '正在更新；下方仍為上次成功讀取的狀態。' : '正在讀取狀態…'
      : `最後更新 ${timeText(snapshot.observedAt)}・自動更新中`;
    refreshButton.disabled = snapshot.refreshing || !snapshot.active;
    summary.replaceChildren(card('UM760 排單連線', dispatch.status === 'fresh' ? '可連線'
      : dispatch.status === 'error' ? '無法連線' : '尚未確認', dispatch.status === 'fresh' ? 'ok' : dispatch.status === 'error' ? 'error' : 'neutral',
      `最後成功：${timeText(dispatch.lastSuccessAt)}`));
    for (const [key, label] of [['pending', '等待中'], ['processing', '處理中'], ['finalizing', '回傳中']]) {
      summary.append(card(label, queue.status === 'fresh' ? String(safeNumber(queue.data?.jobs?.[key])) : '—',
        queue.status === 'error' ? 'error' : 'neutral', queue.status === 'fresh' ? `更新 ${timeText(queue.lastSuccessAt)}` : '排單數量尚未確認'));
    }
    workerArea.replaceChildren();
    const workerTitle = el('div', undefined, 'monitor-worker-title');
    workerTitle.append(el('h4', '運算主機'), el('small', `最後成功：${timeText(workers.lastSuccessAt)}`));
    workerArea.append(workerTitle);
    if (workers.status !== 'fresh') {
      workerArea.append(el('p', workers.status === 'error' ? '無法取得最新主機狀態，已隱藏過期的正常標示。' : '尚未取得主機狀態。'));
      return;
    }
    if (!workers.data.workers.length) { workerArea.append(el('p', '尚無主機回報。')); return; }
    const table = el('table', undefined, 'monitor-table');
    const header = el('tr');
    for (const label of ['主機／支援功能', '狀態', '最近回報', '目前任務']) { const th = el('th', label); th.scope = 'col'; header.append(th); }
    const thead = el('thead'); thead.append(header); table.append(thead);
    const body = el('tbody');
    for (const record of workers.data.workers) {
      const worker = workerPresentation(record, snapshot.observedAt), row = el('tr');
      const name = el('td'); name.append(el('strong', worker.name), el('small', worker.systems));
      const state = el('td'), badge = el('span', worker.status, 'monitor-badge'); badge.dataset.tone = worker.tone; state.append(badge);
      const job = el('td'); job.append(el('code', worker.job));
      row.append(name, state, el('td', worker.recent), job); body.append(row);
    }
    table.append(body); const scroller = el('div', undefined, 'monitor-scroll'); scroller.append(table); workerArea.append(scroller);
  }
  const controller = createMonitorController({ readContext, onState: render });
  refreshButton.addEventListener('click', controller.refresh);
  documentRef.addEventListener('visibilitychange', () => {
    if (documentRef.hidden) controller.stop();
    else if (dialog.open) controller.start();
  });
  return controller;
}
