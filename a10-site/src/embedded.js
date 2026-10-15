import { mountSiteModel } from './main.js?v=20261015-aerial';
import { remoteAdapters } from './remote-adapters.js?v=20261015-aerial';
import publicConfig from './public-config.js?v=20261015-aerial';

const asset = path => new URL(path, import.meta.url).href;
let leafletReady;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafletReady) leafletReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = asset('../vendor/leaflet.js');
    script.onload = resolve;
    script.onerror = () => { script.remove(); leafletReady = null; reject(Error('地圖程式載入失敗，請重試。')); };
    document.head.append(script);
  });
  return leafletReady;
}

// Like A2-3, the editor lives inside the existing tool panel and member session.
export async function mount(host, platform) {
  const response = await fetch(asset('../index.html'), { cache: 'no-cache' });
  if (!response.ok) throw Error('A10-Site 工作區載入失敗，請重試。');
  const template = new DOMParser().parseFromString(await response.text(), 'text/html').getElementById('site-model-root');
  if (!template) throw Error('A10-Site 工作區內容不完整，請重試。');
  template.querySelectorAll('.app-header, .page-title, footer, script').forEach(node => node.remove());
  await loadLeaflet();
  const shadow = host.attachShadow({ mode: 'open' });
  const stylesReady = Promise.all(['../vendor/leaflet.css', '../styles.css?v=20261015-aerial', '../embedded.css?v=20261015-aerial'].map(path => new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = asset(path); link.onload = resolve;
    link.onerror = () => reject(Error('工作區樣式載入失敗，請重試。'));
    shadow.append(link);
  })));
  const accessBar = document.createElement('div'); accessBar.className = 'site-access';
  const notice = document.createElement('p'); notice.setAttribute('role', 'status'); notice.textContent = '本功能使用需管理員開通';
  const login = document.createElement('button'); login.type = 'button'; login.textContent = '會員登入'; login.onclick = platform.login;
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新確認權限';
  accessBar.append(notice, login, retry); shadow.append(accessBar);
  let root, model, owner, sessionVersion = 0, checkVersion = 0, modelVersion = 0;
  let modelReady = Promise.resolve(), history;
  const config = structuredClone(publicConfig);
  config.experimentalLocalWorker.enabled = false; config.experimentalLocalWorker.configured = false;
  const context = { get apiBase() { return platform.apiBase(); }, get token() { return platform.token() || ''; } };
  const identity = () => context.token ? (platform.email() || '').trim().toLowerCase() : '';
  const headers = () => ({ Authorization: 'Bearer ' + context.token });

  function resetModel() {
    const version = ++modelVersion;
    model?.destroy(); model = null;
    root?.remove(); root = template.cloneNode(true); root.inert = true; shadow.append(root);
    root.addEventListener('aias:job-updated', event => {
      if (['partial', 'succeeded', 'failed'].includes(event.detail?.status)) {
        void loadHistory(); void platform.refreshMember?.();
      }
    });
    history = document.createElement('section'); history.className = 'panel site-history'; history.hidden = true;
    root.querySelector('.canvas-column').append(history);
    const target = root;
    modelReady = modelReady.catch(() => {}).then(async () => {
      if (version !== modelVersion) return;
      const mounted = await mountSiteModel(target, { adapters: remoteAdapters(context, config) });
      if (version !== modelVersion) mounted.destroy(); else model = mounted;
    });
    return modelReady;
  }

  async function loadHistory() {
    const version = sessionVersion, target = history;
    const list = target.querySelector('[data-history-list]');
    try {
      const response = await fetch(context.apiBase + '/api/member/jobs', { headers: headers() });
      if (!response.ok) throw Error('暫時無法取得任務，請重新整理或重新登入。');
      const data = await response.json();
      if (version !== sessionVersion) return;
      list.replaceChildren();
      for (const job of (data.jobs || []).filter(job => job.system_id === 'A10_SITE').slice(0, 20)) {
        const row = document.createElement('p');
        row.textContent = new Date(job.created_at * 1000).toLocaleString() + ' · ' + ({ pending: '排隊中', processing: '建模中', finalizing: '回傳中', completed: '已完成', failed: '失敗' }[job.status] || '狀態更新中');
        if (job.status === 'completed') for (const kind of ['skp', 'report']) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = kind === 'skp' ? '下載 SKP' : '下載報告';
          button.onclick = async () => {
            button.disabled = true;
            try {
              const response = await fetch(context.apiBase + `/api/a10-site/jobs/${encodeURIComponent(job.job_id)}/files/${kind}`, { headers: headers() });
              if (!response.ok) throw Error('下載失敗，請重新登入或稍後重試。');
              const blob = await response.blob();
              if (version !== sessionVersion || root.inert) return;
              const url = URL.createObjectURL(blob), link = document.createElement('a');
              link.href = url; link.download = kind === 'skp' ? 'A10-Site.skp' : 'A10-Site-report.json'; link.click();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
            } catch (error) { if (version === sessionVersion) { accessBar.hidden = false; notice.textContent = error.message; } }
            finally { button.disabled = false; }
          };
          row.append(button);
        }
        list.append(row);
      }
      if (!list.childElementCount) list.textContent = '尚無 A10-Site 任務。';
    } catch (error) { if (version === sessionVersion) list.textContent = error.message; }
  }

  async function refreshAccess() {
    const version = ++checkVersion, nextOwner = identity();
    const changed = nextOwner !== owner;
    owner = nextOwner;
    config.experimentalLocalWorker.enabled = false; config.experimentalLocalWorker.configured = false;
    if (root) root.inert = true;
    if (history) history.hidden = true;
    accessBar.hidden = false; notice.textContent = '本功能使用需管理員開通';
    login.hidden = Boolean(context.token); retry.hidden = !context.token;
    let allowed = false, enabled = false, phase = 'model-mount';
    try {
      if (changed || !root) { ++sessionVersion; await resetModel(); }
      if (version !== checkVersion) return;
      if (context.token && context.apiBase) {
        phase = 'access-fetch';
        const [access, state] = await Promise.all([
          fetch(context.apiBase + '/api/a10-site/access', { headers: headers() }),
          fetch(context.apiBase + '/api/a10-site/config'),
        ]);
        if (version !== checkVersion) return;
        phase = 'access-response';
        if (access.status === 401) { login.hidden = false; throw Object.assign(Error('登入驗證已過期，請重新登入。'), { code: 'SESSION_EXPIRED' }); }
        if (!access.ok || !state.ok) throw Object.assign(Error('服務暫時無法回應，請稍後重試。'), { code: 'ACCESS_RESPONSE_FAILED' });
        phase = 'access-json';
        allowed = (await access.json()).allowed === true; enabled = (await state.json()).enabled === true;
      }
      phase = 'model-ready';
      await modelReady;
      if (version !== checkVersion) return;
      config.experimentalLocalWorker.enabled = allowed && enabled; config.experimentalLocalWorker.configured = allowed && enabled;
      phase = 'model-refresh';
      if (typeof model?.refreshConfiguration !== 'function') {
        throw Object.assign(Error('工作區程式版本不同步，請重新整理頁面。'), { code: 'EDITOR_VERSION_MISMATCH' });
      }
      model.refreshConfiguration(); root.inert = !(allowed && enabled); accessBar.hidden = allowed && enabled;
      if (allowed && !enabled) notice.textContent = 'A10-Site 暫停受理新任務，請稍後再試。';
      if (allowed && enabled) {
        phase = 'history';
        history.hidden = false;
        if (!history.childElementCount) {
          history.innerHTML = '<h2>我的 A10-Site 任務</h2><div data-history-list></div><button type="button" class="secondary">重新整理任務</button>';
          history.querySelector('button').onclick = loadHistory;
        }
        await loadHistory();
      }
    } catch (error) {
      if (version !== checkVersion) return;
      // Keep the editor locked on both network and JavaScript failures.
      config.experimentalLocalWorker.enabled = false; config.experimentalLocalWorker.configured = false;
      if (root) root.inert = true;
      if (history) history.hidden = true;
      accessBar.hidden = false;
      const publicMessages = {
        SESSION_EXPIRED: '登入驗證已過期，請重新登入。',
        ACCESS_RESPONSE_FAILED: '服務暫時無法回應，請稍後重試。',
        EDITOR_VERSION_MISMATCH: '工作區程式版本不同步，請重新整理頁面。',
      };
      const code = Object.hasOwn(publicMessages, error?.code) ? error.code : 'EDITOR_REFRESH_FAILED';
      // Only static phase/type/code diagnostics: never tokens, API payloads or account data.
      console.warn('[A10-Site] Editor refresh failed', { phase, errorType: error?.name || 'Error', code });
      notice.textContent = publicMessages[code]
        || (phase === 'access-fetch' && error?.name === 'TypeError'
          ? '無法連線至建模服務，請稍後重試。'
          : '工作區載入失敗，請重新整理頁面；若仍持續發生，請聯絡管理員。');
    }
  }
  retry.onclick = refreshAccess;
  await stylesReady;
  await refreshAccess();
  return { refreshAccess };
}
