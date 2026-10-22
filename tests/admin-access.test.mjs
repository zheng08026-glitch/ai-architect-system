import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminAccess } from '../admin-access.js';

const OWNER = 'fixture-owner@example.invalid';
const SECOND = 'fixture-second@example.invalid';
const session = (email = OWNER, token = 'fixture-secret-token') => ({ access_token: token, user: { email } });
const admin = (email = OWNER, extra = {}) => ({ email, role: 'admin', status: 'active', can_manage_full_features: true, ...extra });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture(plan = request => response(request.url.endsWith('/profile') ? admin() : { members: [] }), timeoutMs = 1000) {
  const states = [], requests = [];
  let handler = plan;
  const access = createAdminAccess({ base: 'https://api.example.invalid/', timeoutMs,
    onChange: state => states.push(state),
    fetchImpl: (url, options) => { const request = { url, ...options }; requests.push(request); return Promise.resolve().then(() => handler(request)); },
  });
  return { access, states, requests, latest: () => states.at(-1), setPlan: next => { handler = next; } };
}

test('admin requests remain gated until profile verification has succeeded', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  await assert.rejects(f.access.request('/api/admin/members'), { code: 'ADMIN_SIGN_IN_REQUIRED' });
  assert.equal(f.requests.length, 0);
  const verification = f.access.setSession(session());
  assert.equal(f.latest().status, 'checking'); assert.equal(f.access.readContext().allowed, false);
  await assert.rejects(f.access.request('/api/admin/members'), { code: 'ADMIN_SIGN_IN_REQUIRED' });
  assert.equal(f.requests.length, 1);
  pending.resolve(response(admin())); await verification;
  assert.equal(f.access.readContext().allowed, true);
  assert.equal(f.latest().status, 'ready');
  f.access.invalidate();
});

test('same pending session deduplicates, and same ready session is a no-op', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  const first = f.access.setSession(session());
  assert.equal(f.access.setSession(session()), first);
  assert.equal(f.requests.length, 1);
  pending.resolve(response(admin())); await first;
  const events = f.states.length;
  await f.access.setSession(session());
  assert.equal(f.states.length, events); assert.equal(f.requests.length, 1);
  f.access.invalidate();
});

test('profile must match claimed identity and have current admin permission', async () => {
  const denied = [admin(SECOND), admin(OWNER, { role: 'member' }), admin(OWNER, { status: 'suspended' }), { role: 'admin' }];
  for (const profile of denied) {
    const f = fixture(() => response(profile));
    await assert.doesNotReject(f.access.setSession(session()));
    assert.equal(f.latest().status, 'denied');
    assert.equal(f.latest().preserveDrafts, false);
    assert.deepEqual(f.access.readContext(), { allowed: false, token: '', identity: '', base: 'https://api.example.invalid', profile: null });
  }
  const primary = fixture(() => response(admin(OWNER, { role: 'member', is_primary_admin: true })));
  await primary.access.setSession(session()); assert.equal(primary.access.readContext().allowed, true);
  primary.access.invalidate();
});

test('session states exclude credentials and unneeded server profile fields', async () => {
  const f = fixture(() => response(admin(OWNER, { access_token: 'fixture-secret-token', refresh_token: 'fixture-refresh-secret', private_debug: 'do-not-expose' })));
  await f.access.setSession(session());
  const serialized = JSON.stringify(f.states);
  assert.equal(serialized.includes('fixture-secret-token'), false);
  assert.equal(serialized.includes('fixture-refresh-secret'), false);
  assert.equal(serialized.includes('do-not-expose'), false);
  assert.equal(f.latest().profile.can_manage_full_features, true);
  const copy = f.access.readContext(); copy.profile.role = 'changed';
  assert.equal(f.access.readContext().profile.role, 'admin');
  f.access.invalidate();
});

test('same-account token refresh preserves drafts while locking access until reverified', async () => {
  const f = fixture(); await f.access.setSession(session());
  const pending = deferred(); f.setPlan(() => pending.promise);
  const work = f.access.setSession(session(OWNER.toUpperCase(), 'fixture-refreshed-token'));
  assert.equal(f.latest().status, 'checking'); assert.equal(f.latest().preserveDrafts, true);
  assert.equal(f.access.readContext().allowed, false);
  pending.resolve(response(admin())); await work;
  assert.equal(f.latest().status, 'ready'); assert.equal(f.latest().preserveDrafts, true);
  assert.equal(f.access.readContext().token, 'fixture-refreshed-token');
  f.access.invalidate();
  assert.equal(f.latest().preserveDrafts, false);
});

test('account change clears drafts and discards late profile response from old identity', async () => {
  const oldBody = deferred();
  const f = fixture(request => request.headers.get('Authorization').includes('second')
    ? response(admin(SECOND)) : { ok: true, status: 200, json: () => oldBody.promise });
  const oldWork = f.access.setSession(session()); await flush();
  const newWork = f.access.setSession(session(SECOND, 'fixture-second-token'));
  assert.equal(f.latest().preserveDrafts, false);
  await newWork; const events = f.states.length;
  oldBody.resolve(admin()); await oldWork;
  assert.equal(f.states.length, events);
  assert.equal(f.latest().status, 'ready'); assert.equal(f.latest().identity, SECOND);
  f.access.invalidate();
});

test('logout immediately cancels profile validation; its late success cannot revive access', async () => {
  const pending = deferred(); const f = fixture(() => pending.promise);
  const work = f.access.setSession(session()); await flush(); f.access.invalidate();
  assert.equal(f.latest().status, 'signedout'); assert.equal(f.requests[0].signal.aborted, true);
  const events = f.states.length;
  pending.resolve(response(admin())); await work;
  assert.equal(f.states.length, events); assert.equal(f.access.readContext().allowed, false);
});

test('late list response body is rejected as stale after logout', async () => {
  const f = fixture(); await f.access.setSession(session());
  const body = deferred(); f.setPlan(() => ({ ok: true, status: 200, json: () => body.promise }));
  const work = f.access.request('/api/admin/members');
  const rejected = assert.rejects(work, error => error.stale === true);
  await flush(); f.access.invalidate();
  body.resolve({ members: [{ email: 'private@example.invalid' }] });
  await rejected;
  assert.equal(f.latest().status, 'signedout');
});

test('late old-account 403 cannot deny a newly verified account', async () => {
  const f = fixture(); await f.access.setSession(session());
  const old = deferred();
  f.setPlan(request => request.url.endsWith('/profile') ? response(admin(SECOND)) : old.promise);
  const oldRequest = f.access.request('/api/admin/members');
  const rejected = assert.rejects(oldRequest, error => error.stale === true);
  await flush(); await f.access.setSession(session(SECOND, 'fixture-second-token'));
  const events = f.states.length;
  old.resolve(response({ detail: 'old account denied' }, 403)); await rejected; await flush();
  assert.equal(f.states.length, events); assert.equal(f.latest().status, 'ready'); assert.equal(f.latest().identity, SECOND);
  f.access.invalidate();
});

test('current 403 invalidates access and preserves the administrator error detail', async () => {
  const f = fixture(); await f.access.setSession(session());
  f.setPlan(() => response({ detail: 'Only the designated owner may grant full access' }, 403));
  await assert.rejects(f.access.request('/api/admin/members/x/full-access', { method: 'PATCH', body: '{"enabled":true}' }), error => error.status === 403 && error.message === 'Only the designated owner may grant full access' && !error.stale);
  assert.equal(f.latest().status, 'denied'); assert.equal(f.latest().profile, null);
  assert.equal(f.access.readContext().token, '');
});

test('non-authentication API errors keep access and preserve structured detail', async () => {
  const f = fixture(); await f.access.setSession(session());
  const detail = [{ field: 'role', message: 'cannot change primary owner' }];
  f.setPlan(() => response({ detail }, 400));
  await assert.rejects(f.access.request('/api/admin/members/x', { method: 'PATCH', body: '{}' }), error => error.status === 400 && error.message === JSON.stringify(detail));
  assert.equal(f.access.readContext().allowed, true);
  f.access.invalidate();
});

test('all requests use no-store and a caller cannot override the verified bearer', async () => {
  const f = fixture(); await f.access.setSession(session());
  await f.access.request('/api/admin/members', { cache: 'force-cache', headers: { Authorization: 'Bearer forged', 'X-Fixture': 'test' } });
  for (const request of f.requests) {
    assert.equal(request.cache, 'no-store');
    assert.equal(request.headers.get('Authorization'), 'Bearer fixture-secret-token');
  }
  assert.equal(f.requests[1].headers.get('X-Fixture'), 'test');
  await assert.rejects(f.access.request('https://elsewhere.invalid/api/admin/members'));
  assert.equal(f.requests.length, 2);
  f.access.invalidate();
});

test('timed-out mutation is aborted and never automatically retried', async () => {
  const f = fixture(undefined, 20); await f.access.setSession(session());
  const pending = deferred(); f.setPlan(() => pending.promise);
  const work = f.access.request('/api/admin/members/x/grant', { method: 'POST', body: '{"amount":10}' });
  await assert.rejects(work, error => error.timeout === true && !error.stale);
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].signal.aborted, true);
  assert.equal(f.access.readContext().allowed, true);
  pending.resolve(response({ success: true })); await flush();
  assert.equal(f.requests.length, 2);
  f.access.invalidate();
});

test('profile timeout settles without throwing and late body cannot emit ready', async () => {
  const body = deferred();
  const f = fixture(() => ({ ok: true, status: 200, json: () => body.promise }), 20);
  await assert.doesNotReject(f.access.setSession(session()));
  assert.equal(f.latest().status, 'error'); assert.equal(f.access.readContext().allowed, false);
  assert.equal(f.requests[0].signal.aborted, true);
  const events = f.states.length;
  body.resolve(admin()); await flush(); assert.equal(f.states.length, events);
  f.access.invalidate();
});

test('profile network failure never rejects setSession and can be explicitly rechecked', async () => {
  const f = fixture(() => Promise.reject(TypeError('network')));
  await assert.doesNotReject(f.access.setSession(session())); assert.equal(f.latest().status, 'error');
  assert.equal(f.requests.length, 2);
  f.setPlan(() => response(admin()));
  await f.access.setSession(session()); assert.equal(f.latest().status, 'ready');
  assert.equal(f.requests.length, 3);
  f.access.invalidate();
});

test('profile check retries once after a timeout and then becomes ready', async () => {
  const slow = deferred(); let calls = 0;
  const f = fixture(() => (++calls === 1 ? slow.promise : response(admin())), 20);
  await f.access.setSession(session());
  assert.equal(f.latest().status, 'ready'); assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].signal.aborted, true);
  slow.resolve(response(admin('fixture-late@example.invalid'))); await flush();
  assert.equal(f.latest().identity, OWNER);
  f.access.invalidate();
});

test('profile check never retries a denial', async () => {
  const f = fixture(() => response({ detail: 'Admin access required' }, 403));
  await f.access.setSession(session());
  assert.equal(f.latest().status, 'denied'); assert.equal(f.requests.length, 1);
});
