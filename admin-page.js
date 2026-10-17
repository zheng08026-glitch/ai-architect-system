import { createAdminAccess } from './admin-access.js?v=20261014-r1';
import { mountMembers } from './admin-members.js?v=20261014-detail-r2';
import { mountMonitor } from './admin-monitor.js?v=20261017-sharedhost';

const byId = id => document.getElementById(id);
const content = byId('adminContent'), gate = byId('adminGate');
const membersPanel = byId('membersPanel'), monitorPanel = byId('monitorPanel');
const tabs = [byId('membersTab'), byId('monitorTab')];
const TOKEN_KEY = 'architect-ai-auth-token', EMAIL_KEY = 'architect-ai-auth-email';
let activeTab = 'members', members, monitor, client, sessionRead = 0;
document.body.dataset.theme = localStorage.getItem('architect-ai-theme') || 'violet';

function showAccess(state) {
  const ready = state.status === 'ready';
  content.hidden = !ready;
  content.inert = !ready;
  gate.hidden = ready;
  byId('adminIdentity').textContent = ready ? state.identity : '管理員專用';
  byId('adminRetry').disabled = state.status === 'checking';
  if (!ready) {
    members?.closeDetail();
    monitor?.stop(state.status === 'checking' ? 'paused' : 'unauthorized');
    if (!state.preserveDrafts || state.status !== 'checking') members?.clear();
    const messages = {
      checking: ['正在確認管理員權限', '正在驗證目前登入帳號，請稍候。'],
      signedout: ['請先登入管理員帳號', '可在主網站完成登入，再回到此頁。'],
      denied: ['此帳號無管理員權限', '請使用具有管理員權限的帳號登入。'],
      error: ['暫時無法確認權限', '請檢查連線，稍後按「重新確認權限」。'],
    };
    const message = messages[state.status] || messages.error;
    byId('adminGateTitle').textContent = message[0];
    byId('adminGateMessage').textContent = message[1];
    return;
  }
  members.updatePermissions();
  if (!members.loaded) void members.load();
  if (activeTab === 'monitor' && !document.hidden) void monitor.start();
}
const access = createAdminAccess({base: String(window.ARCHITECT_AI_API_BASE || '').trim().replace(/\/$/, ''), onChange:showAccess});
members = mountMembers(membersPanel, {request:access.request, readProfile:() => access.readContext().profile});
monitor = mountMonitor(byId('adminMonitor'), {
  readContext:access.readContext,
  isActive:() => activeTab === 'monitor' && access.readContext().allowed,
  onUnauthorized:() => access.invalidate('denied'),
});

function selectTab(name) {
  if (activeTab === name) return;
  activeTab = name;
  const showMembers = name === 'members';
  membersPanel.hidden = !showMembers;
  monitorPanel.hidden = showMembers;
  tabs.forEach((tab, index) => {
    const selected = index === (showMembers ? 0 : 1);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  if (!showMembers && access.readContext().allowed && !document.hidden) void monitor.start();
  else monitor.stop();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(index === 0 ? 'members' : 'monitor'));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    selectTab(next === 0 ? 'members' : 'monitor'); tabs[next].focus();
  });
});

async function readSession() {
  const version = ++sessionRead;
  if (!client) { access.invalidate('error'); return; }
  try {
    const {data, error} = await client.auth.getSession();
    if (version !== sessionRead) return;
    if (error) throw error;
    await access.setSession(data?.session || null);
  } catch { if (version === sessionRead) access.invalidate('error'); }
}
byId('adminRetry').addEventListener('click', readSession);
window.addEventListener('storage', event => {
  if (event.key === 'architect-ai-theme') document.body.dataset.theme = event.newValue || 'violet';
  if (event.key !== null && ![TOKEN_KEY, EMAIL_KEY].includes(event.key)) return;
  sessionRead++;
  const token = localStorage.getItem(TOKEN_KEY), email = localStorage.getItem(EMAIL_KEY);
  if (!token || !email) access.invalidate('signedout');
  else void access.setSession({access_token:token, user:{email}});
});
window.addEventListener('pagehide', () => { sessionRead++; access.invalidate('signedout'); });
window.addEventListener('pageshow', event => { if (event.persisted) void readSession(); });

const configUrl = String(window.ARCHITECT_AI_SUPABASE_URL || '').trim();
const configKey = String(window.ARCHITECT_AI_SUPABASE_ANON_KEY || '').trim();
if (configUrl && configKey && window.supabase?.createClient) {
  client = window.supabase.createClient(configUrl, configKey);
  client.auth.onAuthStateChange((_event, session) => {
    const version = ++sessionRead;
    if (!session) { access.invalidate('signedout'); return; }
    // Keep API work outside the Supabase auth callback/lock.
    queueMicrotask(() => { if (version === sessionRead) void access.setSession(session); });
  });
  void readSession();
} else access.invalidate('error');
