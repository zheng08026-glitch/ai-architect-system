// A11-1 PDF(向量格式) 2 DXF: lives inside the workspace tool panel (like A10-Site) and uses the member session of the page.
// All member data goes through textContent; nothing from the server is written as HTML.
const asset = path => new URL(path, import.meta.url).href;
const MAX_MB = 30;
const POLL_MS = 3000;
const FAIL_LIMIT = 6;
const STATUS_LABEL = { pending: '排隊中', processing: '轉換中', completed: '已完成', failed: '未完成' };
const FILES = [
  { kind: 'dxf', label: '下載 DXF', suffix: '.dxf', primary: true },
  { kind: 'dimensions', label: '尺寸核對表（CSV）', suffix: '_dimensions.csv' },
  { kind: 'preview', label: '預覽圖（PNG）', suffix: '_preview.png' },
  { kind: 'report', label: '轉換報告（JSON）', suffix: '_report.json' },
];
const SCALE_SOURCE = {
  dimension_lines: '由圖面尺寸標註自動判斷',
  given: '依您指定的比例',
  size_labels: '由家具尺寸推估，請核對一段已知長度',
  assumed: '無法判斷，暫以 1:100 輸出，請核對一段已知長度',
};

const TEMPLATE = `
<div class="a11-access" role="status"><p data-notice>本功能使用需管理員開通</p>
  <button type="button" data-login>會員登入</button><button type="button" data-retry>重新確認權限</button></div>
<div class="a11-work" data-work inert>
  <section class="a11-panel a11-input">
    <h3><span class="a11-step">01</span>上傳 PDF</h3>
    <label class="a11-drop" data-drop><span data-file-label>選擇 PDF 檔案</span>
      <small>CAD 直接輸出的 PDF，最大 ${MAX_MB} MB</small>
      <input type="file" accept=".pdf,application/pdf" aria-label="上傳 PDF 圖面" data-file></label>
    <p class="a11-hint">只支援 AutoCAD 等軟體直接「列印／輸出」的向量 PDF，不扣點數。掃描的竣工圖請等待 A11-2（研發中）。</p>
    <details class="a11-advanced"><summary>進階設定（通常不用改）</summary>
      <label>頁碼 <input type="number" min="1" max="500" step="1" value="1" inputmode="numeric" data-page></label>
      <label>出圖比例 1: <input type="number" min="1" max="5000" step="any" placeholder="自動判斷" inputmode="decimal" data-scale></label>
      <p class="a11-hint">比例留空時，系統會用圖面上的尺寸標註自動判斷。</p>
    </details>
    <h3><span class="a11-step">02</span>開始轉換</h3>
    <button type="button" class="a11-primary" data-go disabled>轉換成 DXF</button>
    <p class="a11-msg" role="status" data-msg></p>
  </section>
  <section class="a11-panel a11-result" aria-live="polite">
    <h3>轉換結果</h3>
    <p class="a11-empty" data-empty>上傳 PDF 並按「轉換成 DXF」後，結果會顯示在這裡。</p>
    <div data-progress hidden>
      <p class="a11-stage" data-stage>排隊中</p>
      <div class="a11-bar"><span data-bar></span></div>
      <p class="a11-hint" data-elapsed></p>
    </div>
    <div data-done hidden>
      <figure class="a11-preview"><img alt="DXF 預覽圖" data-preview><figcaption data-preview-note>預覽圖由轉換後的 DXF 重新繪製。</figcaption></figure>
      <dl class="a11-summary" data-summary></dl>
      <ul class="a11-warnings" data-warnings hidden></ul>
      <div class="a11-actions" data-actions></div>
      <p class="a11-hint">DXF 單位為公釐（mm），已依出圖比例還原為實際尺寸，並保留原 CAD 圖層。辨識出的尺寸數字另存在 AIAS_DIM_TEXT 圖層（可編輯文字），原本的筆畫數字在 AIAS_DIM_STROKE 圖層。</p>
    </div>
    <p class="a11-failed" data-failed hidden></p>
  </section>
  <section class="a11-panel a11-history">
    <div class="a11-history-head"><h3>我的 A11 任務</h3><button type="button" class="a11-secondary" data-refresh>重新整理</button></div>
    <div data-history><p class="a11-hint">尚無任務。</p></div>
  </section>
</div>`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function timedFetch(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function errorText(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string' && /[一-鿿]/.test(data.detail)) return data.detail;
  } catch { /* not JSON */ }
  return fallback;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

export async function mount(host, platform) {
  const shadow = host.attachShadow({ mode: 'open' });
  await new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = asset('./embedded.css?v=20261111-a11');
    link.onload = resolve; link.onerror = () => reject(Error('A11 樣式載入失敗，請重試。'));
    shadow.append(link);
  });
  const wrap = el('div', 'a11'); wrap.innerHTML = TEMPLATE; shadow.append(wrap);
  const q = selector => wrap.querySelector(selector);
  const ui = {
    access: q('.a11-access'), notice: q('[data-notice]'), login: q('[data-login]'), retry: q('[data-retry]'), work: q('[data-work]'),
    drop: q('[data-drop]'), file: q('[data-file]'), fileLabel: q('[data-file-label]'), page: q('[data-page]'), scale: q('[data-scale]'),
    go: q('[data-go]'), msg: q('[data-msg]'), empty: q('[data-empty]'), progress: q('[data-progress]'), stage: q('[data-stage]'),
    bar: q('[data-bar]'), elapsed: q('[data-elapsed]'), done: q('[data-done]'), preview: q('[data-preview]'),
    previewNote: q('[data-preview-note]'), summary: q('[data-summary]'), warnings: q('[data-warnings]'), actions: q('[data-actions]'),
    failed: q('[data-failed]'), history: q('[data-history]'), refresh: q('[data-refresh]'),
  };

  let file = null, submitting = false, allowed = false, owner, session = 0, check = 0, watching = null, shownJob = null, previewUrl = '';
  const keys = new Map();
  const token = () => platform.token() || '';
  const api = () => platform.apiBase();
  const auth = () => ({ Authorization: 'Bearer ' + token() });
  const identity = () => token() ? (platform.email() || '').trim().toLowerCase() : '';

  function guide() {
    wrap.querySelectorAll('.is-next').forEach(node => node.classList.remove('is-next'));
    if (!allowed) return;
    // Finished job on screen -> download; otherwise pick a file, then convert.
    const next = !ui.done.hidden ? ui.actions.querySelector('.a11-primary')
      : !file ? ui.drop : (!submitting && !watching && !ui.go.disabled) ? ui.go : null;
    next?.classList.add('is-next');
  }

  function showPanel(name) {
    for (const key of ['empty', 'progress', 'done', 'failed']) ui[key].hidden = key !== name;
    guide();
  }

  function updateInputs() {
    ui.fileLabel.textContent = file ? file.name : '選擇 PDF 檔案';
    ui.drop.classList.toggle('has-file', Boolean(file));
    for (const input of [ui.file, ui.page, ui.scale]) input.disabled = submitting;
    ui.go.disabled = !file || submitting || Boolean(watching);
    ui.go.textContent = submitting ? '上傳中…' : watching ? '轉換進行中' : '轉換成 DXF';
    guide();
  }

  function stopWatching() { watching = null; }

  function resetSession() {
    session += 1; stopWatching(); file = null; keys.clear(); shownJob = null; ui.file.value = '';
    ui.msg.textContent = ''; ui.history.replaceChildren(el('p', 'a11-hint', '尚無任務。'));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ''; ui.preview.removeAttribute('src'); showPanel('empty'); updateInputs();
  }

  ui.file.addEventListener('change', () => {
    const picked = ui.file.files[0];
    if (!picked) return;
    if (!/\.pdf$/i.test(picked.name) && picked.type !== 'application/pdf') { ui.msg.textContent = '請選擇 PDF 檔案。'; return; }
    if (!picked.size || picked.size > MAX_MB * 1024 * 1024) { ui.msg.textContent = `請選擇非空白、${MAX_MB} MB 以下的 PDF。`; return; }
    file = picked; ui.msg.textContent = ''; updateInputs();
  });

  async function submit() {
    if (!file || submitting || watching) return;
    if (!token()) { platform.login(); return; }
    const page = Math.trunc(Number(ui.page.value || 1));
    const scale = ui.scale.value.trim() ? Number(ui.scale.value) : 0;
    if (!(page >= 1 && page <= 500)) { ui.msg.textContent = '頁碼請填 1 到 500。'; return; }
    if (scale && !(scale >= 1 && scale <= 5000)) { ui.msg.textContent = '出圖比例請填 1 到 5000，或留空自動判斷。'; return; }
    // The same file + settings reuse one request key, so a retry after a lost response never creates a second job.
    const keyName = [file.name, file.size, file.lastModified, page, scale].join('|');
    if (!keys.has(keyName)) keys.set(keyName, crypto.randomUUID());
    const form = new FormData();
    form.append('file', file); form.append('request_key', keys.get(keyName)); form.append('page', String(page));
    if (scale) form.append('scale', String(scale));
    const version = session;
    submitting = true; ui.msg.textContent = ''; updateInputs();
    try {
      const response = await timedFetch(api() + '/api/a11/jobs', { method: 'POST', headers: auth(), body: form }, 300000);
      if (version !== session) return;
      if (response.status === 401) { platform.login(); throw Error('登入驗證已過期，請重新登入後再送出。'); }
      if (!response.ok) {
        const fallback = { 403: '本功能使用需管理員開通', 413: `檔案超過 ${MAX_MB} MB，請縮小後再試。`, 429: '目前排隊已滿，請稍後再試。', 503: 'A11 暫停受理新任務，請稍後再試。' }[response.status]
          || '送出失敗，請稍後再試。';
        throw Error(await errorText(response, fallback));
      }
      const job = await response.json();
      submitting = false;
      void watch(job.job_id, version);
      void loadHistory();
    } catch (error) {
      if (version !== session) return;
      ui.msg.textContent = error.name === 'AbortError'
        ? '上傳逾時，送件狀態不明。請先看下方「我的 A11 任務」，相同檔案與設定再按一次不會重複送件。'
        : error.message || '送出失敗，請稍後再試。';
    } finally {
      if (version === session) { submitting = false; updateInputs(); }
    }
  }
  ui.go.addEventListener('click', () => { void submit(); });

  async function watch(jobId, version = session) {
    const token_ = {};
    watching = token_; shownJob = jobId; updateInputs();
    showPanel('progress'); ui.stage.textContent = '排隊中'; ui.bar.style.width = '5%'; ui.elapsed.textContent = '';
    let failures = 0, lastStatus = '';
    const started = Date.now();
    while (watching === token_ && version === session) {
      try {
        const response = await timedFetch(api() + '/api/a11/jobs/' + encodeURIComponent(jobId), { headers: auth() }, 15000);
        if (response.status === 401) { stopWatching(); platform.login(); ui.stage.textContent = '登入驗證已過期，請重新登入後查看任務。'; break; }
        if (!response.ok) throw Error('status ' + response.status);
        const job = await response.json();
        if (watching !== token_ || version !== session) return;
        failures = 0;
        if (job.status !== lastStatus) { lastStatus = job.status; void loadHistory(); }
        if (job.status === 'completed') { stopWatching(); await showDone(job, version); void loadHistory(); void platform.refreshMember?.(); break; }
        if (job.status === 'failed') { stopWatching(); showFailed(job); void loadHistory(); break; }
        const since = job.created_at ? Date.now() / 1000 - job.created_at : (Date.now() - started) / 1000;
        if (job.status === 'pending') {
          ui.stage.textContent = job.queue_position > 1 ? `排隊中（前面還有 ${job.queue_position - 1} 個任務）` : '排隊中，即將開始';
          ui.bar.style.width = '8%';
        } else {
          ui.stage.textContent = '轉換中：讀取向量線條、判斷比例、核對尺寸、繪製預覽…';
          ui.bar.style.width = `${Math.min(92, 15 + since * 0.9)}%`;
        }
        ui.elapsed.textContent = `已經過 ${formatTime(since)}，一般圖面約 1～2 分鐘。可以離開此頁，之後在「我的 A11 任務」查看。`;
      } catch {
        failures += 1;
        if (failures >= FAIL_LIMIT) { ui.elapsed.textContent = '連線暫時中斷，轉換仍會在背景進行，請稍後按「重新整理」查看。'; stopWatching(); break; }
      }
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
    if (version === session) updateInputs();
  }

  async function download(job, kind, suffix, button) {
    button.disabled = true;
    try {
      const response = await timedFetch(api() + `/api/a11/jobs/${encodeURIComponent(job.job_id)}/files/${kind}`, { headers: auth() }, 300000);
      if (response.status === 401) { platform.login(); throw Error('登入驗證已過期，請重新登入後下載。'); }
      if (!response.ok) throw Error('下載失敗，請稍後再試。');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = (job.source_name || 'drawing') + suffix; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { ui.msg.textContent = error.name === 'AbortError' ? '下載逾時，請再試一次。' : error.message; }
    finally { button.disabled = false; }
  }

  async function showDone(job, version) {
    const r = job.result || {};
    ui.summary.replaceChildren();
    const row = (label, value) => { ui.summary.append(el('dt', '', label), el('dd', '', value)); };
    row('檔案', job.source_name || '');
    if (r.scale_denominator) row('出圖比例', `1:${Math.round(r.scale_denominator * 100) / 100}（${SCALE_SOURCE[r.scale_source] || '請核對'}）`);
    const dims = r.dimensions || {};
    const okCount = dims.ok || 0, checkCount = (dims.check || 0) + (dims.no_dim_line || 0);
    row('尺寸核對', okCount || checkCount ? `${okCount} 個尺寸與圖面長度吻合${checkCount ? `，${checkCount} 個請人工核對（見尺寸核對表）` : ''}` : '未辨識到尺寸標註數字，請核對一段已知長度');
    if (r.layers) row('圖層', `${r.layers} 個（保留原 CAD 圖層）`);
    const e = r.entities || {};
    const lines = (e.LINE || 0) + (e.LWPOLYLINE || 0) + (e.ARC || 0) + (e.CIRCLE || 0);
    row('圖元', `線段／弧 ${lines.toLocaleString()}、填色 ${(e.HATCH || 0).toLocaleString()}、文字 ${((e.TEXT || 0) + (e.DIM_TEXT || 0)).toLocaleString()}`);
    if (r.match?.pdf_ink_found_in_dxf) row('與原圖比對', `原圖線條 ${(r.match.pdf_ink_found_in_dxf * 100).toFixed(2)}% 已重現於 DXF`);
    const warnings = (r.warnings || []).filter(Boolean);
    ui.warnings.replaceChildren(...warnings.map(text => el('li', '', /raster image/.test(text) ? '圖面內含點陣圖片，圖片部分不會轉成線條。' : /preview/.test(text) ? '預覽圖無法產生，DXF 不受影響。' : text)));
    ui.warnings.hidden = !warnings.length;
    ui.actions.replaceChildren();
    for (const item of FILES) {
      const button = el('button', item.primary ? 'a11-primary' : 'a11-secondary', item.label); button.type = 'button';
      button.addEventListener('click', () => { void download(job, item.kind, item.suffix, button); });
      ui.actions.append(button);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ''; ui.preview.removeAttribute('src'); ui.preview.hidden = true; ui.previewNote.textContent = '正在載入預覽圖…';
    showPanel('done');
    try {
      const response = await timedFetch(api() + `/api/a11/jobs/${encodeURIComponent(job.job_id)}/files/preview`, { headers: auth() }, 60000);
      if (!response.ok) throw Error();
      const blob = await response.blob();
      if (version !== session || shownJob !== job.job_id) return;
      previewUrl = URL.createObjectURL(blob); ui.preview.src = previewUrl; ui.preview.hidden = false;
      ui.previewNote.textContent = '預覽圖由轉換後的 DXF 重新繪製，用來確認線條是否完整。';
    } catch { if (version === session) ui.previewNote.textContent = '預覽圖無法載入，DXF 仍可下載。'; }
    guide();
  }

  function showFailed(job) {
    ui.failed.textContent = job.public_error || '轉換未完成，請稍後再試或聯絡管理員。';
    showPanel('failed');
  }

  async function openJob(job) {
    if (job.status === 'completed') { stopWatching(); shownJob = job.job_id; await showDone(job, session); updateInputs(); }
    else if (job.status === 'failed') { stopWatching(); shownJob = job.job_id; showFailed(job); updateInputs(); }
    else void watch(job.job_id);
  }

  async function loadHistory() {
    const version = session;
    try {
      const response = await timedFetch(api() + '/api/a11/jobs', { headers: auth() }, 15000);
      if (!response.ok) throw Error(response.status === 401 ? '登入驗證已過期，請重新登入。' : '暫時無法取得任務紀錄，請稍後重新整理。');
      const jobs = (await response.json()).jobs || [];
      if (version !== session) return jobs;
      ui.history.replaceChildren();
      for (const job of jobs) {
        const item = el('div', 'a11-row');
        const when = job.created_at ? new Date(job.created_at * 1000).toLocaleString('zh-TW', { hour12: false }) : '';
        item.append(el('span', 'a11-row-time', when), el('span', 'a11-row-name', job.source_name || ''),
          el('span', `a11-row-status is-${job.status}`, STATUS_LABEL[job.status] || '處理中'));
        const open = el('button', 'a11-secondary', job.status === 'completed' ? '查看結果' : job.status === 'failed' ? '查看原因' : '查看進度');
        open.type = 'button'; open.addEventListener('click', () => { void openJob(job); });
        item.append(open);
        ui.history.append(item);
      }
      if (!jobs.length) ui.history.append(el('p', 'a11-hint', '尚無任務。'));
      return jobs;
    } catch (error) {
      if (version === session) ui.history.replaceChildren(el('p', 'a11-hint', error.name === 'AbortError' ? '連線逾時，請稍後重新整理。' : error.message));
      return [];
    }
  }
  ui.refresh.addEventListener('click', async () => {
    const jobs = await loadHistory();
    const current = jobs.find(job => job.job_id === shownJob);
    if (current && !watching) void openJob(current);
  });

  async function refreshAccess() {
    const version = ++check, next = identity();
    if (next !== owner) { owner = next; resetSession(); }
    allowed = false; ui.work.inert = true; ui.access.hidden = false; guide();
    ui.login.hidden = Boolean(token()); ui.retry.hidden = !token();
    if (!token()) { ui.notice.textContent = '請先登入會員後使用 A11-1 PDF(向量格式) 2 DXF（會員可用，不扣點數）。'; return; }
    ui.notice.textContent = '正在確認使用權限…';
    try {
      const [access, config] = await Promise.all([
        timedFetch(api() + '/api/a11/access', { headers: auth() }, 15000),
        timedFetch(api() + '/api/a11/config', {}, 15000),
      ]);
      if (version !== check) return;
      if (access.status === 401) { ui.login.hidden = false; ui.notice.textContent = '登入驗證已過期，請重新登入。'; return; }
      if (!access.ok || !config.ok) throw Error('service');
      const [a, c] = [await access.json(), await config.json()];
      if (version !== check) return;
      if (a.allowed !== true) { ui.notice.textContent = '本功能使用需管理員開通'; return; }
      if (c.enabled !== true) { ui.notice.textContent = 'A11 暫停受理新任務，請稍後再試。'; return; }
      allowed = true; ui.access.hidden = true; ui.work.inert = false; updateInputs();
      const jobs = await loadHistory();
      const active = jobs.find(job => job.status === 'pending' || job.status === 'processing');
      if (active && !watching && version === check) void watch(active.job_id);
    } catch (error) {
      if (version !== check) return;
      ui.notice.textContent = error?.name === 'TypeError' || error?.name === 'AbortError' ? '無法連線至轉換服務，請稍後重試。' : '服務暫時無法回應，請稍後重試。';
    }
  }
  ui.login.addEventListener('click', () => platform.login());
  ui.retry.addEventListener('click', () => { void refreshAccess(); });
  updateInputs();
  await refreshAccess();
  return { refreshAccess };
}
