import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonitorController, mountMonitor, workerPresentation } from '../admin-monitor.js';

const INITIAL_TIME = 1_800_000_000_000;
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const payload = (url, name = 'fixture-worker') => url.endsWith('/health') ? { ok: true }
  : url.endsWith('/workers') ? { workers: [{ worker_name: name, online: true, state: 'idle', last_seen_at: INITIAL_TIME / 1000, supported_systems: ['A10_V1', 'A10_SITE'], current_job_id: '' }] }
  : { jobs: { pending: 4, processing: 2, finalizing: 1, completed: 100 } };

function clock() {
  let time = INITIAL_TIME, nextId = 0;
  const tasks = new Map();
  return {
    now: () => time,
    schedule: (callback, ms) => { const id = ++nextId; tasks.set(id, { callback, at: time + ms }); return id; },
    cancel: id => tasks.delete(id),
    set: value => { time = value; },
    size: () => tasks.size,
    async advance(ms) {
      const target = time + ms;
      for (;;) {
        const entry = [...tasks.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, task] = entry; tasks.delete(id); time = task.at;
        task.callback(); await flush();
      }
      time = target; await flush();
    },
  };
}

function harness(fetchPlan = request => response(payload(request.url))) {
  const timer = clock(), states = [], requests = [];
  let context = { allowed: true, token: 'fixture-secret-owner-token', identity: 'fixture-owner@example.invalid', base: 'https://fixture.invalid' };
  let plan = fetchPlan;
  const controller = createMonitorController({
    readContext: () => context,
    onState: state => states.push(state),
    fetchImpl: (url, options) => { const request = { url, ...options }; requests.push(request); return Promise.resolve().then(() => plan(request)); },
    now: timer.now, schedule: timer.schedule, cancel: timer.cancel,
    intervalMs: 15000, timeoutMs: 8000,
  });
  return { controller, timer, states, requests, latest: () => states.at(-1),
    context: () => context, setContext: next => { context = next; }, setPlan: next => { plan = next; } };
}

test('no request is sent without a permitted authenticated context', async () => {
  for (const change of [{ allowed: false }, { token: '' }, { base: '' }]) {
    const h = harness(); h.setContext({ ...h.context(), ...change });
    await h.controller.start();
    assert.equal(h.requests.length, 0);
    assert.equal(h.latest().active, false);
    assert.equal(h.latest().sections.workers.status, 'unauthorized');
  }
});

test('successful collection uses bearer only for admin APIs and never emits credentials', async () => {
  const h = harness(); await h.controller.start();
  assert.equal(h.requests.length, 3);
  for (const request of h.requests) {
    assert.equal(request.cache, 'no-store');
    assert.equal(request.headers.Authorization, request.url.endsWith('/health') ? undefined : 'Bearer fixture-secret-owner-token');
  }
  for (const section of Object.values(h.latest().sections)) {
    assert.equal(section.status, 'fresh'); assert.equal(section.lastSuccessAt, INITIAL_TIME);
  }
  assert.equal(h.latest().refreshing, false);
  assert.equal(JSON.stringify(h.states).includes('fixture-secret-owner-token'), false);
  assert.equal(JSON.stringify(h.states).includes('fixture-owner@example.invalid'), false);
  h.controller.stop();
});

test('refresh reuses in-flight collection and schedules only after completion', async () => {
  const waiting = [];
  const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
  const first = h.controller.start();
  assert.equal(h.controller.refresh(), first);
  assert.equal(h.controller.refresh(), first);
  await flush(); assert.equal(h.requests.length, 3);
  for (const entry of waiting) entry.resolve(response(payload(entry.request.url)));
  await first;
  assert.equal(h.timer.size(), 1);
  await h.timer.advance(14999); assert.equal(h.requests.length, 3);
  await h.timer.advance(1); assert.equal(h.requests.length, 6);
  h.controller.stop();
  for (const entry of waiting.slice(3)) entry.resolve(response(payload(entry.request.url)));
  await flush();
});

test('one failed endpoint becomes stale without erasing independent successful sections', async () => {
  const h = harness(); await h.controller.start();
  const previous = h.latest().sections.workers;
  h.timer.set(INITIAL_TIME + 5000);
  h.setPlan(request => request.url.endsWith('/workers') ? Promise.reject(new TypeError('network')) : response(payload(request.url)));
  await h.controller.refresh();
  const state = h.latest();
  assert.equal(state.sections.workers.status, 'error');
  assert.deepEqual(state.sections.workers.data, previous.data);
  assert.equal(state.sections.workers.lastSuccessAt, previous.lastSuccessAt);
  assert.equal(state.sections.dispatch.status, 'fresh');
  assert.equal(state.sections.queue.lastSuccessAt, INITIAL_TIME + 5000);
  h.controller.stop();
});

test('invalid response shapes are failures, not fabricated healthy/zero results', async () => {
  const h = harness(() => response({})); await h.controller.start();
  for (const section of Object.values(h.latest().sections)) {
    assert.equal(section.status, 'error'); assert.equal(section.data, null); assert.equal(section.lastSuccessAt, null);
  }
  h.controller.stop();
});

test('deadline aborts hung requests and their eventual success cannot repaint', async () => {
  const waiting = [];
  const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
  const work = h.controller.start(); await flush();
  await h.timer.advance(8000); await work;
  assert.equal(h.latest().refreshing, false);
  for (const request of h.requests) assert.equal(request.signal.aborted, true);
  for (const section of Object.values(h.latest().sections)) assert.equal(section.status, 'error');
  const count = h.states.length;
  for (const entry of waiting) entry.resolve(response(payload(entry.request.url)));
  await flush(); assert.equal(h.states.length, count);
  assert.equal(h.timer.size(), 1);
  h.controller.stop();
});

test('stop aborts collection, clears private snapshots and prevents delayed repaint', async () => {
  const waiting = [];
  const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
  const work = h.controller.start(); await flush(); h.controller.stop();
  assert.equal(h.latest().active, false); assert.equal(h.latest().refreshing, false);
  assert.ok(h.requests.every(request => request.signal.aborted));
  for (const section of Object.values(h.latest().sections)) assert.equal(section.data, null);
  const count = h.states.length;
  for (const entry of waiting) entry.resolve(response(payload(entry.request.url, 'old-account-worker')));
  await work; assert.equal(h.states.length, count); assert.equal(h.timer.size(), 0);
});

test('logout or changed token while collecting discards all success responses', async () => {
  for (const change of [{ allowed: false, token: '' }, { token: 'fixture-new-token' }, { identity: 'other@example.invalid' }]) {
    const waiting = [];
    const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
    const work = h.controller.start(); await flush(); h.setContext({ ...h.context(), ...change });
    for (const entry of waiting) entry.resolve(response(payload(entry.request.url)));
    await work;
    assert.equal(h.latest().active, false);
    for (const section of Object.values(h.latest().sections)) {
      assert.equal(section.status, 'unauthorized'); assert.equal(section.data, null);
    }
  }
});

test('auth UI check immediately clears monitoring before pending requests settle', async () => {
  const waiting = [];
  const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
  const work = h.controller.start(); await flush();
  h.setContext({ ...h.context(), allowed: false, token: '', identity: '' });
  h.controller.checkAccess();
  assert.equal(h.latest().active, false);
  assert.ok(h.requests.every(request => request.signal.aborted));
  assert.ok(Object.values(h.latest().sections).every(section => section.status === 'unauthorized' && section.data === null));
  const count = h.states.length;
  for (const entry of waiting) entry.resolve(response(payload(entry.request.url)));
  await work; assert.equal(h.states.length, count);
});

test('restarted account cannot be overwritten by the previous account response', async () => {
  const waiting = [];
  const h = harness(request => { const d = deferred(); waiting.push({ ...d, request }); return d.promise; });
  const oldWork = h.controller.start(); await flush();
  h.setContext({ ...h.context(), token: 'fixture-second-token', identity: 'second@example.invalid' });
  const newWork = h.controller.start(); await flush();
  for (const entry of waiting.slice(3)) entry.resolve(response(payload(entry.request.url, 'second-account-worker')));
  await newWork;
  const count = h.states.length;
  for (const entry of waiting.slice(0, 3)) entry.resolve(response(payload(entry.request.url, 'old-account-worker')));
  await oldWork;
  assert.equal(h.states.length, count);
  assert.equal(h.latest().sections.workers.data.workers[0].worker_name, 'second-account-worker');
  h.controller.stop();
});

test('an authorization failure clears every section and stops automatic refresh', async () => {
  const h = harness(request => response(payload(request.url), request.url.endsWith('/workers') ? 403 : 200));
  await h.controller.start();
  assert.equal(h.latest().active, false); assert.equal(h.timer.size(), 0);
  for (const section of Object.values(h.latest().sections)) {
    assert.equal(section.status, 'unauthorized'); assert.equal(section.data, null);
  }
});

test('worker labels distinguish heartbeat from confirmed hardware health', () => {
  const worker = { worker_name: 'fixture', online: true, state: 'idle', last_seen_at: INITIAL_TIME / 1000 - 12 };
  assert.equal(workerPresentation(worker, INITIAL_TIME).status, '待命');
  assert.equal(workerPresentation(worker, INITIAL_TIME).recent, '12 秒前');
  assert.equal(workerPresentation({ ...worker, current_job_id: 'job' }, INITIAL_TIME).status, '處理中');
  assert.equal(workerPresentation({ ...worker, state: 'unknown' }, INITIAL_TIME).status, '有回報・狀態待確認');
  assert.equal(workerPresentation({ ...worker, online: 'true' }, INITIAL_TIME).status, '未回報');
  assert.equal(workerPresentation({ ...worker, online: false }, INITIAL_TIME).status, '未回報');
});

class Element extends EventTarget {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw Error('Fixture rejects HTML-string rendering; use text nodes'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; this._text = ''; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
class DocumentFixture extends EventTarget {
  constructor() { super(); this.hidden = false; this.created = []; }
  createElement(tag) { const element = new Element(tag); this.created.push(element); return element; }
}

test('DOM rendering treats hostile worker fields as text and hides stale normal badges', async t => {
  const previousFetch = globalThis.fetch;
  const documentRef = new DocumentFixture(), host = documentRef.createElement('section'), dialog = { open: true };
  const hostile = '<img src=x onerror=alert(1)>';
  let workerFailure = false;
  globalThis.fetch = async url => {
    if (url.endsWith('/workers') && workerFailure) throw TypeError('network');
    const value = payload(url, hostile);
    if (value.workers) { value.workers[0].current_job_id = '<script>hostile()</script>'; value.workers[0].supported_systems = ['<svg onload=hostile()>']; }
    return response(value);
  };
  const controller = mountMonitor(host, { readContext: () => ({ allowed: true, token: 'fixture-token', identity: 'fixture@example.invalid', base: 'https://fixture.invalid' }), dialog, documentRef });
  t.after(() => { controller.stop(); globalThis.fetch = previousFetch; });
  await controller.start();
  assert.ok(host.textContent.includes(hostile));
  assert.equal(documentRef.created.some(node => ['IMG', 'SCRIPT', 'SVG'].includes(node.tagName)), false);
  assert.ok(host.textContent.includes('不保證 GPU、SketchUp 或任務進度正常'));
  workerFailure = true; await controller.refresh();
  assert.ok(host.textContent.includes('已隱藏過期的正常標示'));
  assert.equal(host.textContent.includes(hostile), false);
});

test('hidden page pauses and returning to a closed dialog does not restart requests', async t => {
  const previousFetch = globalThis.fetch;
  const documentRef = new DocumentFixture(), host = documentRef.createElement('section'), dialog = { open: true };
  let calls = 0;
  globalThis.fetch = async url => { calls++; return response(payload(url)); };
  const controller = mountMonitor(host, { readContext: () => ({ allowed: true, token: 'fixture-token', identity: 'fixture@example.invalid', base: 'https://fixture.invalid' }), dialog, documentRef });
  t.after(() => { controller.stop(); globalThis.fetch = previousFetch; });
  await controller.start(); assert.equal(calls, 3);
  documentRef.hidden = true; documentRef.dispatchEvent(new Event('visibilitychange'));
  assert.ok(host.textContent.includes('監控已暫停'));
  dialog.open = false; documentRef.hidden = false; documentRef.dispatchEvent(new Event('visibilitychange'));
  await flush(); assert.equal(calls, 3);
  dialog.open = true; documentRef.dispatchEvent(new Event('visibilitychange'));
  await flush(); assert.equal(calls, 6);
});
