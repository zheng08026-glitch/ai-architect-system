import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const implementation = [
  section('function a10V1Inputs()', 'let a10Watching'),
  section('function a10PublicError(', 'function setA10Result('),
  section('function openJobResult(', 'function renderJobProgress('),
  section('function activateSystem(', 'function systemButton('),
  section('function getPublicJobError(', 'function formatJobTime('),
].join('\n');

class Element {
  constructor() { this.events = {}; this.children = []; this.nodes = new Map(); this.value = ''; }
  set innerHTML(value) { this.html = value; this.text = ''; this.children = []; this.nodes.clear(); }
  get innerHTML() { return this.html || ''; }
  set textContent(value) { this.text = value; this.html = ''; this.children = []; this.nodes.clear(); }
  get textContent() { return this.text || ''; }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  append(child) { this.children.push(child); }
  scrollIntoView() {}
  click() { this.events.click?.({ target: this }); }
}

function fixture(fetcher, options = {}) {
  const preview = new Element();
  const inputs = new Element();
  const calls = [];
  const results = [];
  const timers = new Set();
  const sandbox = {
    AbortController, DOMException, FormData, performance,
    crypto: { randomUUID: () => `id-${Math.random()}` },
    setTimeout(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
    clearTimeout(id) { timers.delete(id); clearTimeout(id); },
    fetch: async (url, init) => { calls.push({ url, init }); return fetcher(url, init, calls.length); },
    document: { createElement: () => new Element(), querySelector: () => new Element() },
    mainPreview: preview, inputStack: inputs, thumbGrid: new Element(),
    authDialog: { close() {}, showModal() {} }, authMessage: new Element(),
    getAuthToken: () => 'fixture-token', getAuthHeaders: () => ({ Authorization: 'Bearer fixture-token' }),
    getApiBase: () => 'https://fixture.invalid',
    escapeHtml: (s) => String(s).replaceAll('<', '&lt;'),
    showResultMessage: (_, message) => { preview.textContent = message; },
    setA10Result: (job) => { results.push(job); preview.textContent = `completed:${job.job_id}`; },
    loadMemberCenter: async () => {},
    renderResult: () => { preview.textContent = 'ready'; },
    renderApp: () => { preview.textContent = 'ready'; },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`
    let activeId='A10_V1', a10Watching=null, a10ViewVersion=0;
    let activeResultJobId='', activeResultType='', a93PresetLoadVersion=0;
    let expandedSidebarGroup=null, isHowToUseOpen=false;
    let memberJobs=[];
    const systems=[{id:'A10_V1',result:'model',status:'Live System'},{id:'A10',result:'model',status:'Live System'},{id:'A1-1',result:'prompt',status:'Live System'}];
    const getSystem=id=>systems.find(s=>s.id===id), getActiveSystem=()=>getSystem(activeId);
    const A10_STATUS_TIMEOUT_MS=${options.requestMs || 10}, A10_WATCH_DURATION_MS=${options.watchMs || 1000};
    const A10_POLL_INTERVAL_MS=1, A10_FETCH_FAILURE_LIMIT=5;
    let a10V1File=null,a10V1Exterior='',a10V1Unit='cm',a10V1Submitting=false;
    const a10V1Keys=new Map(),a10JobVersions=new Map();
    const a10RequestKeys=new WeakMap(),uploadedFiles=new Map();
    let a10Submitting=false,a10DrawingUnit='cm';
    ${implementation}
  `, context);
  return { preview, inputs, calls, results, timers, context,
    run: (code) => vm.runInContext(code, context),
    watch: (job='job-a') => context.watchA10(job, 'A10_V1') };
}

const response = (body, status=200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const job = (status, extra={}) => ({ job_id:'job-a', system_id:'A10_V1', status, ...extra });
const pause = (ms=5) => new Promise(r=>setTimeout(r,ms));
const privateDetail = 'Traceback C:\\private\\secret.py token=secret http://192.0.2.1/internal';

test('retired A10 refuses new submissions without calling an API', async () => {
  const f = fixture(() => { throw new Error('retired submission must not make a request'); });
  await assert.rejects(f.context.submitA10(), /A10-Bata/);
  assert.equal(f.calls.length, 0);
});

test('production timing limits remain 15 seconds and two hours', () => {
  assert.match(source, /A10_STATUS_TIMEOUT_MS = 15000/);
  assert.match(source, /A10_WATCH_DURATION_MS = 2 \* 60 \* 60 \* 1000/);
});

for (const [status, expected] of [[401,/登入/],[403,/帳號/],[404,/找不到/],[409,/狀態已改變/],[422,/輸入錯誤/]]) {
  test(`HTTP ${status} is visible from A10-v1 history and stops polling`, async () => {
    const f=fixture(()=>response({detail:privateDetail},status));
    f.run(`memberJobs=[${JSON.stringify(job('pending'))}];openJobResult(0)`);
    await pause();
    assert.match(f.preview.textContent,expected);
    assert.doesNotMatch(f.preview.textContent,/secret|192\.0\.2/);
    assert.equal(f.calls.length,1);
    assert.equal(f.preview.children.length,0);
    assert.equal(f.run('a10Watching'),null);
    assert.equal(f.timers.size,0);
  });
}

for (const [status, extra, expected] of [
  ['failed',{},/系統錯誤/], ['failed',{error_type:'input'},/輸入錯誤/],
  ['failed',{error_code:'A10_UNIT_UNRESOLVED'},/圖面單位/],
  ['timeout',{},/逾時/], ['timed_out',{},/逾時/], ['unsupported',{},/無法可靠處理/],
  ['needs_review',{},/圖面條件/], ['cancelled',{},/已取消/],
]) {
  test(`${status} terminates with a safe public reason`,async()=>{
    const f=fixture(()=>response(job(status,{...extra,error:privateDetail,public_error:`系統錯誤 ${privateDetail}`})));
    await f.watch();
    assert.match(f.preview.textContent,expected);
    assert.doesNotMatch(f.preview.textContent,/secret|Traceback|192\.0\.2/);
    assert.equal(f.calls.length,1);
    assert.equal(f.preview.children.length,0);
    assert.equal(f.timers.size,0);
  });
}

test('actual dispatch pending/processing/finalizing states end in the correct result',async()=>{
  const states=['pending','processing','finalizing','completed'];
  const f=fixture(()=>response(job(states.shift())));
  await f.watch();
  assert.equal(f.calls.length,4);
  assert.equal(f.results.length,1);
  assert.equal(f.results[0].job_id,'job-a');
  assert.equal(f.run('a10Watching'),null);
  assert.equal(f.timers.size,0);
});

for (const kind of ['network','fetch-stall','body-stall','invalid-json','server-503']) {
  test(`${kind} stops after five failures and retries only GET for the same job`,async()=>{
    let recovered=false;
    const f=fixture(()=> {
      if(recovered)return response(job('completed'));
      if(kind==='network')throw new TypeError(privateDetail);
      if(kind==='fetch-stall')return new Promise(()=>{});
      if(kind==='body-stall')return {ok:true,json:()=>new Promise(()=>{})};
      if(kind==='invalid-json')return {ok:true,json:async()=>{throw new SyntaxError(privateDetail);}};
      return response({detail:privateDetail},503);
    });
    await f.watch();
    assert.equal(f.calls.length,5);
    assert.equal(f.results.length,0);
    assert.match(f.preview.textContent,/勿重複送件/);
    if(kind==='server-503')assert.match(f.preview.textContent,/尚未啟用/);
    assert.doesNotMatch(f.preview.textContent,/secret|Traceback|192\.0\.2/);
    assert.equal(f.preview.children[0].textContent,'重新查詢此任務');
    assert.equal(f.timers.size,0);
    recovered=true;f.preview.children[0].click();await pause();
    assert.equal(f.results.length,1);
    assert.equal(f.calls.length,6);
    assert.ok(f.calls.every(c=>c.url.endsWith('/api/jobs/job-a')&&!c.init.method));
  });
}

test('a real elapsed deadline ends even a continuing successful pending sequence',async()=>{
  const f=fixture(()=>response(job('pending')),{watchMs:15});
  await f.watch();
  assert.match(f.preview.textContent,/時間上限/);
  assert.equal(f.run('a10Watching'),null);
  assert.equal(f.timers.size,0);
});

test('stopping a stalled request releases timers and permits querying the same job',async()=>{
  const f=fixture(()=>new Promise(()=>{}));
  const pending=f.watch();await pause(1);
  f.preview.querySelector('[data-a10-stop]').click();
  await pending;
  assert.match(f.preview.textContent,/已停止查詢/);
  assert.equal(f.calls[0].init.signal.aborted,true);
  assert.equal(f.timers.size,0);
  assert.equal(f.run('a10Watching'),null);
});

for(const late of ['completed','http-error','network-error']) {
  test(`old ${late} response cannot overwrite a newer task`,async()=>{
    let release,reject;
    const old=new Promise((r,j)=>{release=r;reject=j;});
    const f=fixture(url=>url.endsWith('job-a')?old:response(job('completed',{job_id:'job-b'})));
    const first=f.watch();await pause(1);await f.watch('job-b');
    if(late==='network-error')reject(new Error(privateDetail));
    else release(late==='completed'?response(job('completed')):response({detail:privateDetail},403));
    await first;await pause();
    assert.equal(f.preview.textContent,'completed:job-b');
    assert.equal(f.results.length,1);
    assert.equal(f.timers.size,0);
  });
}

test('switching away and back invalidates the old request, including old errors',async()=>{
  let release;
  const f=fixture(()=>new Promise(r=>{release=r;}));
  const pending=f.watch();await pause(1);
  f.run(`activateSystem('A1-1');activateSystem('A10_V1')`);
  release(response({detail:privateDetail},401));await pending;
  assert.equal(f.preview.textContent,'ready');
  assert.equal(f.calls[0].init.signal.aborted,true);
});

for(const change of ['file','exterior']) {
  test(`${change} change invalidates an existing watch and its stale retry button`,async()=>{
    const f=fixture(()=>{throw new TypeError('offline');});
    await f.watch();const retry=f.preview.children[0];
    f.run('a10V1Inputs()');
    if(change==='file'){
      const input=f.inputs.querySelector('input');input.files=[{name:'B.dxf',size:10}];input.events.change();
      assert.equal(f.run('a10V1File.name'),'B.dxf');
    }else{
      const select=f.inputs.querySelector('[data-v1-exterior]');select.value='curtain';select.events.change();
      assert.equal(f.run('a10V1Exterior'),'curtain');
    }
    retry.click();await pause();assert.equal(f.calls.length,5);
    assert.equal(f.preview.textContent,'ready');
  });
}

test('wrong job identity and unknown state stop without presenting a completed result',async()=>{
  for(const value of [job('completed',{job_id:'other'}),job('completed',{system_id:'A10'}),job('unexpected')]){
    const f=fixture(()=>response(value));await f.watch();
    assert.equal(f.results.length,0);assert.match(f.preview.textContent,/無法確認/);
    assert.equal(f.calls.length,1);
  }
});

test('submission uses the same idempotency key on retry and sends explicit mode/finish',async()=>{
  let posts=[];
  const f=fixture((url,init)=>{
    if(url.endsWith('/config'))return response({enabled:true,drawing_units:['mm','cm','m']});
    posts.push(Object.fromEntries(init.body.entries()));
    return response({detail:privateDetail},503);
  });
  f.context.sampleFile=new Blob(['fixture'],{type:'application/octet-stream'});
  f.run(`a10V1File=sampleFile;a10V1Exterior='curtain'`);
  await f.run('submitA10V1(4)');await f.run('submitA10V1(4)');await f.run('submitA10V1(1)');
  assert.equal(posts[0].request_key,posts[1].request_key);
  assert.equal(posts[0].mode,'4');assert.equal(posts[0].exterior_type,'curtain');
  assert.equal(posts[2].mode,'1');assert.equal(posts[2].exterior_type,'');
  assert.equal(f.run('a10V1Submitting'),false);
  assert.doesNotMatch(f.preview.textContent,/secret/);
});

test('a file above the host upload limit is stopped before posting',async()=>{
  let posts=0;
  const f=fixture((url)=>{
    if(url.endsWith('/config'))return response({enabled:true,drawing_units:['mm','cm','m'],max_upload_bytes:4});
    posts+=1;return response({job_id:'job-x'});
  });
  f.context.sampleFile=new Blob(['fixture'],{type:'application/octet-stream'});
  f.run('a10V1File=sampleFile');
  await f.run('submitA10V1(1)').catch(error=>f.run('a10ErrorMessage')(error));
  assert.equal(posts,0);
  assert.equal(f.run('a10V1Submitting'),false);
  assert.equal(f.run('A10_V1_MAX_BYTES'),95*1024*1024);
});

test('a late submit response after navigation does not start a watch or overwrite the new view',async()=>{
  let release;
  const f=fixture(url=>url.endsWith('/config')?response({enabled:true,drawing_units:['mm','cm','m']}):new Promise(r=>{release=r;}));
  f.context.sampleFile=new Blob(['fixture']);
  f.run('a10V1File=sampleFile');
  const submitting=f.run('submitA10V1(1)');await pause(1);
  f.run(`activateSystem('A1-1');activateSystem('A10_V1')`);
  release(response({job_id:'job-a'}));await submitting;
  assert.equal(f.calls.length,2);assert.equal(f.run('a10Watching'),null);
  assert.equal(f.preview.textContent,'ready');assert.equal(f.run('a10V1Submitting'),false);
});

test('member-history failure text is sanitized before the task is opened',()=>{
  const f=fixture(()=>{});
  const value=job('failed',{error:privateDetail,public_error:`系統錯誤 ${privateDetail}`});
  const message=f.run(`getPublicJobError(${JSON.stringify(value)})`);
  assert.match(message,/系統錯誤/);assert.doesNotMatch(message,/secret|Traceback|192\.0\.2/);
});

for(const change of ['file','exterior','mode']){
  test(`${change} change prevents a late old failure from replacing the new view`,async()=>{
    let release;
    const f=fixture(url=>url.includes('/api/jobs/')?new Promise(r=>{release=r;}):response({enabled:false}));
    const watching=f.watch();await pause(1);f.run('a10V1Inputs()');
    if(change==='file'){
      const input=f.inputs.querySelector('input');input.files=[{name:'B.dxf',size:10}];input.events.change();
    }else if(change==='exterior'){
      const select=f.inputs.querySelector('[data-v1-exterior]');select.value='solid';select.events.change();
    }else{
      f.context.sampleFile=new Blob(['fixture']);f.run('a10V1File=sampleFile');
      await f.run('submitA10V1(2)');
    }
    const current=f.preview.textContent;
    release(response({detail:privateDetail},403));await watching;
    assert.equal(f.preview.textContent,current);
    assert.equal(f.calls[0].init.signal.aborted,true);
    assert.equal(f.timers.size,0);
  });
}

test('submission sends the selected drawing unit and a unit change uses a new idempotency key',async()=>{
  let posts=[];
  const f=fixture((url,init)=>{
    if(url.endsWith('/config'))return response({enabled:true,drawing_units:['mm','cm','m']});
    posts.push(Object.fromEntries(init.body.entries()));
    return response({detail:'busy'},503);
  });
  f.context.sampleFile=new Blob(['fixture']);
  f.run(`a10V1File=sampleFile`);
  await f.run('submitA10V1(1)');
  f.run(`a10V1Unit='mm'`);
  await f.run('submitA10V1(1)');await f.run('submitA10V1(1)');
  assert.equal(posts[0].drawing_unit,'cm');assert.equal(posts[1].drawing_unit,'mm');
  assert.notEqual(posts[0].request_key,posts[1].request_key);
  assert.equal(posts[1].request_key,posts[2].request_key);
});

test('a host without drawing-unit support receives no submission',async()=>{
  const f=fixture(url=>url.endsWith('/config')?response({enabled:true}):response({job_id:'job-a'}));
  f.context.sampleFile=new Blob(['fixture']);
  f.run('a10V1File=sampleFile');
  await f.run('submitA10V1(1)');
  assert.equal(f.calls.length,1);assert.match(f.preview.textContent,/單位功能尚未更新/);
});

test('unit change invalidates an existing watch and its stale retry button',async()=>{
  const f=fixture(()=>{throw new TypeError('offline');});
  await f.watch();const retry=f.preview.children[0];
  f.run('a10V1Inputs()');
  const select=f.inputs.querySelector('[data-v1-unit]');select.value='m';select.events.change();
  assert.equal(f.run('a10V1Unit'),'m');
  retry.click();await pause();assert.equal(f.calls.length,5);
  assert.equal(f.preview.textContent,'ready');
});
