// Admin-only request boundary. Session credentials never enter public state events.
export function createAdminAccess({ base, fetchImpl = fetch, onChange = () => {}, timeoutMs = 12000 } = {}) {
  const apiBase = String(base || '').replace(/\/+$/, '');
  const profileFields = ['email', 'plan', 'role', 'status', 'is_primary_admin',
    'full_feature_access', 'can_manage_full_features', 'profile'];
  let generation = 0, token = '', identity = '', profile = null, status = 'signedout';
  let validation, preserveDrafts = false;
  const controllers = new Set();
  const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const staleError = () => Object.assign(new Error('登入狀態已變更，已忽略先前的回覆。'), { stale: true, code: 'STALE_ADMIN_RESPONSE' });
  const snapshot = () => ({ status, identity, profile: profile ? structuredClone(profile) : null, preserveDrafts });
  const emit = () => {
    try { onChange(snapshot()); }
    catch { console.error('[AdminAccess] State listener failed'); }
  };
  const current = captured => captured.generation === generation && captured.token === token && captured.identity === identity;
  const guard = captured => { if (!current(captured)) throw staleError(); };
  const capture = () => ({ generation, token, identity });
  const abortRequests = () => {
    for (const controller of controllers) controller.abort(staleError());
    controllers.clear();
  };

  function invalidate(reason = 'signedout') {
    ++generation; abortRequests(); validation = undefined;
    token = ''; identity = ''; profile = null; preserveDrafts = false;
    status = ['signedout', 'denied', 'error'].includes(reason) ? reason : 'signedout';
    emit();
  }

  async function send(path, options, captured) {
    guard(captured);
    if (typeof path !== 'string' || !path.startsWith('/api/') || path.includes('\\')) {
      throw new Error('不支援的管理員 API 路徑。');
    }
    if (!apiBase) throw new Error('管理員服務尚未設定。');
    const controller = new AbortController(); controllers.add(controller);
    const externalSignal = options.signal;
    let timer;
    const aborted = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(controller.signal.reason instanceof Error ? controller.signal.reason
          : Object.assign(new Error('請求已取消。'), { name: 'AbortError' }));
      }, { once: true });
    });
    const externalAbort = () => controller.abort(externalSignal.reason instanceof Error
      ? externalSignal.reason : Object.assign(new Error('請求已取消。'), { name: 'AbortError' }));
    if (externalSignal?.aborted) externalAbort();
    else externalSignal?.addEventListener('abort', externalAbort, { once: true });
    timer = setTimeout(() => controller.abort(Object.assign(
      new Error('請求逾時；若剛才已送出修改，請先查詢結果再操作，避免重複送出。'),
      { timeout: true, code: 'ADMIN_REQUEST_TIMEOUT' },
    )), timeoutMs);
    try {
      return await Promise.race([
        (async () => {
          if (controller.signal.aborted) throw controller.signal.reason;
          const headers = new Headers(options.headers || {});
          if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
          headers.set('Authorization', `Bearer ${captured.token}`);
          const response = await fetchImpl(apiBase + path, { ...options, headers, cache: 'no-store', signal: controller.signal });
          guard(captured);
          let data;
          try { data = response.status === 204 ? null : await response.json(); }
          catch (error) { if (response.ok) throw error; data = null; }
          guard(captured);
          if (!response.ok) {
            const detail = data?.detail;
            throw Object.assign(new Error(typeof detail === 'string' ? detail
              : detail ? JSON.stringify(detail) : '管理員請求失敗，請稍後重試。'), { status: response.status });
          }
          return data;
        })(),
        aborted,
      ]);
    } catch (error) {
      if (!current(captured)) throw staleError();
      throw error;
    } finally {
      clearTimeout(timer); controllers.delete(controller);
      externalSignal?.removeEventListener('abort', externalAbort);
    }
  }

  function setSession(session) {
    const nextToken = typeof session?.access_token === 'string' ? session.access_token : '';
    const nextIdentity = normalize(session?.user?.email);
    if (!nextToken || !nextIdentity) { invalidate(); return Promise.resolve(snapshot()); }
    if (token === nextToken && identity === nextIdentity) {
      if (status === 'checking' && validation) return validation;
      if (status === 'ready') return Promise.resolve(snapshot());
    }
    const sameIdentity = Boolean(identity && identity === nextIdentity);
    ++generation; abortRequests(); validation = undefined;
    token = nextToken; identity = nextIdentity; profile = null; preserveDrafts = sameIdentity;
    status = 'checking';
    const captured = capture(); emit();
    const work = (async () => {
      try {
        let data;
        for (let attempt = 1; ; attempt++) {
          try { data = await send('/api/member/profile', {}, captured); break; }
          catch (error) {
            // The profile check is a read: a busy server or a dropped connection gets one more try.
            const transient = error?.timeout === true || error instanceof TypeError;
            if (attempt >= 2 || !transient || !current(captured) || error?.stale) throw error;
          }
        }
        guard(captured);
        if (normalize(data?.email) !== captured.identity
          || !(data?.role === 'admin' || data?.is_primary_admin === true)
          || (data?.status && !['active', 'trialing'].includes(data.status))) {
          invalidate('denied'); return snapshot();
        }
        profile = Object.fromEntries(profileFields.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
        status = 'ready'; emit();
      } catch (error) {
        if (!current(captured) || error?.stale) return snapshot();
        if ([401, 403].includes(error?.status)) invalidate('denied');
        else { status = 'error'; profile = null; emit(); }
      } finally { if (current(captured)) validation = undefined; }
      return snapshot();
    })();
    validation = work;
    return work;
  }

  async function request(path, options = {}) {
    if (status !== 'ready' || !token || !profile) {
      throw Object.assign(new Error('請先以管理員帳號登入。'), { status: 401, code: 'ADMIN_SIGN_IN_REQUIRED' });
    }
    const captured = capture();
    try { return await send(path, options, captured); }
    catch (error) {
      if (!current(captured) || error?.stale) throw staleError();
      if ([401, 403].includes(error?.status)) invalidate('denied');
      throw error;
    }
  }

  return {
    setSession, invalidate, request,
    readContext: () => ({ allowed: status === 'ready', token, identity, base: apiBase,
      profile: profile ? structuredClone(profile) : null }),
  };
}
