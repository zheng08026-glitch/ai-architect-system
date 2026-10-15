import { createHttpAdapters } from './adapters.js';
import { createLeafletMap } from './map.js';
import { createGoogleMap } from './google-map.js';
import { createGoogleServices } from './google-services.js';
import { boundsFromCenter, measureBounds, validateBounds, buildRequest } from './domain.js';
import { reliefCovered, RELIEF_COVERAGE_MESSAGE } from './terrain-coverage.js';

/** Mount into a root with index.html's component markup. State belongs to this instance only. */
export async function mountSiteModel(root, { adapters = createHttpAdapters(), mapFactory = createLeafletMap, googleMapFactory = createGoogleMap, googleServicesFactory = createGoogleServices, onRequest } = {}) {
  const $ = id => root.querySelector(`#${id}`);
  const state = { mode: 'address', bounds: null, confirmedAt: null, selection: { method: 'map', query: '', candidate: null, markerConfirmed: false }, candidates: [], searching: false, queryVersion: 0, drawing: false, pendingEdits: false, destroyed: false };
  state.terrainMode = 'flat';
  state.siteOptions = {buildingMode:'massing',floorHeightM:3,fallbackHeightM:9,aerialMode:'private-photo2',contextMode:'schematic',blockMaterial:'aerial'};
  state.provider = 'osm'; state.basemap = 'osm'; state.providerBusy = false;
  let requestController, map, config, googleServices, removeGoogleError;
  let activeGeocoder = adapters.geocoder;
  const mapClass = $('map').className;
  const mapStyle = $('map').style.cssText;
  let googleFailure = false;
  const jobFlow = { submitting: false, polling: false, job: null, coverage: null, manifest: null, requestBounds: null, idempotencyKey: null, requestKey: null, timer: null };
  const googleDerived = () => state.selection.provenance === 'google-geocoding' || state.selection.candidate?.provider === 'google';
  const scopeVisible = () => !googleDerived() || state.provider === 'google';
  const listeners = [];
  const listen = (element, event, handler) => { element.addEventListener(event, handler); listeners.push(() => element.removeEventListener(event, handler)); };
  const status = (id, message, tone = '') => { $(id).textContent = message; $(id).dataset.tone = tone; };
  const number = value => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value);
  const defaultSourceDescription = $('model-source-description').textContent;
  const defaultPartialDescription = $('partial-consent-description').textContent;
  const nlscConfigured = () => config?.map?.nlscAerial?.displayOnly === true && typeof config.map.nlscAerial.url === 'string';
  const leafletConfig = () => state.basemap === 'nlsc-aerial'
    ? { ...config.map.nlscAerial, id: 'nlsc-aerial' }
    : { ...(config?.map || config?.basemap || {}), id: 'osm' };
  function renderBasemap() {
    const google=state.provider==='google', nlsc=!google&&state.basemap==='nlsc-aerial';
    $('leaflet-basemap-field').hidden=google;
    $('basemap-notice').hidden=google;
    // The long official attribution and tile-inherent labels need the lower map
    // edge; keep our decorative location badge out of that space for PHOTO2.
    $('map-location-label').hidden=nlsc;
    $('leaflet-basemap').value=state.basemap;
    $('leaflet-basemap').querySelector('option[value="nlsc-aerial"]').disabled=!nlscConfigured();
    $('map-provider-label').textContent=google?'Google 一般地圖 · 非航照':nlsc?'國土測繪中心正射影像 · 僅顯示':'OSM 街道底圖 · 非航照';
    $('basemap-notice').replaceChildren();
    if(nlsc){
      $('basemap-notice').append(document.createTextNode('國土測繪中心航照已接入顯示，可定位與框選；本次未接影像匯出或 SKP 貼圖。© 內政部國土測繪中心｜正射影像圖（臺灣通用）。'));
      for(const [label,url] of [['來源服務','https://maps.nlsc.gov.tw/'],['使用規定','https://maps.nlsc.gov.tw/pro/use_clause.jsp']]){
        const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener';
        $('basemap-notice').append(document.createTextNode(' '),link);
      }
    }else $('basemap-notice').textContent='OSM 街道圖僅供定位，並非航照成果。切換底圖會保留已選範圍與 Photon 地址標記。';
  }
  const spacing = value => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 3 }).format(value);
  const terrainSampling = terrain => [Number.isFinite(terrain?.nominalResolutionM) && terrain.nominalResolutionM > 0 ? `來源格網 ${spacing(terrain.nominalResolutionM)}m` : '來源解析度待確認', Number.isFinite(terrain?.intermediateSpacingM) && terrain.intermediateSpacingM > 0 ? `中間取樣 ${spacing(terrain.intermediateSpacingM)}m` : '', Number.isFinite(terrain?.meshSpacingM) && terrain.meshSpacingM > 0 ? `建模網格 ${spacing(terrain.meshSpacingM)}m` : ''].filter(Boolean).join('；');
  const localWorkerEnabled = () => !!(config?.experimentalLocalWorker?.enabled && config?.experimentalLocalWorker?.configured && config?.capabilities?.jobs && config?.capabilities?.skp);
  let editedRangeKind = 'size';
  const generationLimits = () => config?.experimentalLocalWorker?.limits || null;
  function generationRangeError(bounds, draft = false) {
    const limits = generationLimits();
    if (!limits) return '';
    let size;
    if (draft && state.pendingEdits && editedRangeKind === 'size') {
      const widthM = Number($('width-input').value), depthM = Number($('depth-input').value);
      size = { widthM, depthM, areaM2: widthM * depthM };
    } else {
      if (draft && state.pendingEdits) bounds = Object.fromEntries(['west', 'south', 'east', 'north'].map(key => [key, Number($(key + '-input').value)]));
      try { size = measureBounds(bounds); } catch { return ''; }
    }
    if (size.widthM > limits.maxSideM + 1e-6 || size.depthM > limits.maxSideM + 1e-6 || size.areaM2 > limits.maxAreaM2 + 0.001) {
      return '超出生成上限：寬度與深度各不得超過 ' + number(limits.maxSideM) + ' 公尺，面積不得超過 ' + number(limits.maxAreaM2) + ' m²。請縮小範圍後再確認。';
    }
    return '';
  }
  const sameBounds = (a, b) => !!a && !!b && ['west', 'south', 'east', 'north'].every(key => Number.isFinite(a[key]) && Number.isFinite(b[key]) && Math.abs(a[key] - b[key]) < 1e-7);
  // 含高程輸出 only has DTM data for 臺北市; checked once per range because a 2 km grid takes ~20 ms.
  let reliefCheck = { key: '', covered: true };
  const reliefOutside = () => {
    if (state.terrainMode !== 'relief' || !state.bounds) return false;
    const key = JSON.stringify(state.bounds);
    if (reliefCheck.key !== key) reliefCheck = { key, covered: reliefCovered(state.bounds) };
    return !reliefCheck.covered;
  };
  const activeJob = () => ['queued', 'running'].includes(jobFlow.job?.status);
  const matchesJob = () => JSON.stringify(jobFlow.job?.requestedOutputs?.siteOptions || {}) === JSON.stringify(state.siteOptions) && (jobFlow.job?.requestedOutputs?.terrainMode || 'relief') === state.terrainMode && sameBounds(state.bounds, jobFlow.job?.bounds || jobFlow.requestBounds);
  function artifactUrl(type) {
    const manifest = jobFlow.manifest;
    const artifact = manifest?.artifacts?.[type];
    if (!jobFlow.job || manifest?.jobId !== jobFlow.job.id || !['partial', 'succeeded'].includes(manifest.status) || !sameBounds(manifest.bounds, jobFlow.job.bounds || jobFlow.requestBounds) || artifact?.status !== 'available' || artifact.verified !== true || !artifact.downloadUrl) return null;
    if (type === 'aerial' && (artifact.licensed !== true || artifact.synthetic !== false || artifact.metadata?.synthetic !== false || !sameBounds(artifact.metadata?.bbox, manifest.bounds))) return null;
    try {
      const url = new URL(artifact.downloadUrl, location.href);
      return url.origin === location.origin && url.pathname === `/api/jobs/${encodeURIComponent(jobFlow.job.id)}/download/${type}` && !url.search && !url.hash ? url.href : null;
    } catch { return null; }
  }
  function showCoverage(coverage) {
    $('job-gaps').replaceChildren();
    for (const gap of coverage?.gaps || []) { const item = document.createElement('li'); item.textContent = gap.message || gap.code; $('job-gaps').append(item); }
    const year = coverage?.terrain?.sourceYear || coverage?.actual?.terrainSourceYear;
    const dates = coverage?.terrain?.sourceDates || coverage?.actual?.terrainSourceDates;
    if (year) { const item = document.createElement('li'); item.textContent = `本次地形來源：${coverage.terrain?.sourceTitle ? `${coverage.terrain.sourceTitle}；` : ''}${year} 年${Array.isArray(dates) && dates.length ? `（來源日期 ${dates.join('、')}）` : ''}；${terrainSampling(coverage.terrain)} 歷史資料${coverage.terrain?.verticalDatum ? `；高程基準 ${coverage.terrain.verticalDatum}` : ''}，非現況實測。`; $('job-gaps').append(item); }
    $('job-coverage-label').textContent = coverage ? '資料限制（實際來源與缺漏請以成果報告為準）' : '送出前會先檢查範圍與已知資料限制。';
  }
  function updateJob(ready) {
    const enabled = localWorkerEnabled();
    const confirmed = ready && !!state.confirmedAt;
    const current = matchesJob();
    const busy = jobFlow.submitting || activeJob();
    const complete = current && ['partial', 'succeeded'].includes(jobFlow.job?.status);
    const aerialAvailable = current && !!artifactUrl('aerial');
    const aerialMetadata = aerialAvailable ? jobFlow.manifest.artifacts.aerial.metadata : null;
    const satellite = aerialMetadata?.imageryKind === 'satellite';
    const imageryLabel = satellite ? '衛星影像' : '航照';
    const syntheticAerial = current && (jobFlow.manifest?.artifacts?.aerial?.synthetic === true || jobFlow.manifest?.artifacts?.aerial?.metadata?.synthetic === true);
    const textValue = value => typeof value === 'string' && value.trim() ? value.trim() : '未知';
    const dataset = config?.experimentalLocalWorker?.dataset;
    const hasDemoBounds = validateBounds(dataset?.demoBounds).valid;
    $('dataset-demo').hidden = !hasDemoBounds;
    $('load-dataset-range').disabled = !hasDemoBounds || !map || state.providerBusy;
    $('load-dataset-range').textContent = /nyc|紐約/i.test(`${dataset?.id || ''} ${dataset?.title || ''}`) ? '載入 NYC 示範範圍' : '載入資料集示範範圍';
    if (dataset?.id) {
      const terrain = dataset.terrain || {};
      const terrainDescription = `${textValue(terrain.sourceTitle)}，${terrain.sourceYear || '年份未知'} 年；${terrainSampling(terrain)}，高程基準 ${textValue(terrain.verticalDatum)}`;
      const buildingsDescription = `${textValue(dataset.buildings?.sourceTitle)} 高度依來源欄位；仍需現況核對，缺高不補造`;
      const roadsDescription = dataset.roads?.representation === 'centerlines-only' ? '道路僅中心線' : '道路資料依來源標示，未核驗實際邊界';
      $('model-source-description').textContent = `${textValue(dataset.title)}。建物：${buildingsDescription}。地形：${terrainDescription}，非現況實測。${roadsDescription}。`;
      $('partial-consent-description').textContent = `同意先產生部分成果：${buildingsDescription}；${roadsDescription}；地形為 ${terrainDescription} 歷史資料，並非現況實測。影像僅在來源授權與驗證通過後提供，否則不含影像；並非完整基地模型。`;
    } else {
      $('model-source-description').textContent = defaultSourceDescription;
      $('partial-consent-description').textContent = defaultPartialDescription;
    }
    if (state.terrainMode === 'flat') {
      $('model-source-description').textContent = '全平面輸出：忽略地形起伏，建物基底使用 Z=0。建物高度依來源；缺高仍保留輪廓，道路目前僅中心線。';
      $('partial-consent-description').textContent = '同意先產生部分成果：全平面模式忽略地形高程，Z=0 為任意模型基準；建物高度未實測核實，缺高不補造；道路僅中心線，航照須來源與驗證通過後才提供。';
    }
    const heightText=state.siteOptions.buildingMode==='massing' ? '來源高度優先，其次樓層估高；仍缺高建築以 '+state.siteOptions.fallbackHeightM+'m 建立示意量體，特殊例外保留輪廓。' : state.siteOptions.buildingMode==='levels' ? '來源高度優先；缺高且樓層資料明確者以每層 '+state.siteOptions.floorHeightM+'m 估高，例外留輪廓。' : '只使用來源高度，缺高保留輪廓。';
    const terrainText=state.terrainMode==='flat'?'全平面 Z=0，忽略地勢。':'保留歷史 DTM 高程起伏，非基地實測。';
    const contextText=state.siteOptions.contextMode==='schematic'?'道路寬度與街廓為示意；捷運路線不代表高架或地下高程。':'道路僅中心線。';
    $('model-source-description').textContent=heightText+terrainText+contextText;
    $('partial-consent-description').textContent='同意產生部分成果：'+heightText+terrainText+contextText+(state.siteOptions.aerialMode==='private-photo2'?'官方航照僅內嵌私人模型，原始標示保留；取得失敗會列入缺漏。':'未選擇官方航照內嵌。');
    $('worker-state').textContent = enabled ? '建模服務可用' : '建模服務未啟用';
    const reliefBlocked = reliefOutside();
    $('relief-coverage-warning').hidden = !reliefBlocked;
    $('relief-coverage-warning').textContent = reliefBlocked ? RELIEF_COVERAGE_MESSAGE : '';
    $('accept-partial').disabled = !enabled || !confirmed || busy;
    $('generate-skp').disabled = !enabled || !confirmed || !$('accept-partial').checked || busy || complete || reliefBlocked;
    $('generate-skp').textContent = jobFlow.submitting ? '檢查與送出中…' : activeJob() ? '建模中…' : complete ? '此範圍已有成果' : '產生基地模型 SKP';
    $('generate-skp').title = enabled ? '由 AIAS 建模服務執行；航照須通過來源授權與影像驗證' : '本功能使用需管理員開通';
    $('download-skp').disabled = !confirmed || !current || !artifactUrl('model');
    $('download-report').disabled = !confirmed || !current || !artifactUrl('report');
    $('download-skp').textContent = artifactUrl('model') && current ? '下載已驗證的部分成果 SKP' : '下載 SKP · 尚無已驗證檔案';
    $('download-aerial').disabled = !confirmed || !aerialAvailable;
    $('download-aerial').textContent = aerialAvailable ? `下載已驗證的授權${imageryLabel} PNG` : '↓ 下載航照 PNG · 尚無已驗證檔案';
    $('download-aerial').closest('.output-grid > div').querySelector('h3').firstChild.textContent = satellite ? '選取範圍衛星影像 ' : '選取範圍航照圖 ';
    $('aerial-date').textContent = aerialMetadata ? textValue(aerialMetadata.acquisitionDate) : '未知 · 待來源提供';
    $('aerial-resolution').textContent = aerialMetadata && Number.isFinite(aerialMetadata.nominalResolutionM) && aerialMetadata.nominalResolutionM > 0 ? `${aerialMetadata.nominalResolutionM} m/pixel（來源標稱）；列印比例尺依輸出尺寸` : '未知 · 待來源解析度';
    $('aerial-source').textContent = aerialMetadata ? `${textValue(aerialMetadata.sourceTitle)}；${textValue(aerialMetadata.attribution)}；授權：${textValue(aerialMetadata.licenseId)}（${textValue(aerialMetadata.licenseUrl)}）` : syntheticAerial ? '合成測試影像，非真實航照，不提供航照下載' : '尚無已驗證授權航照';
    $('model-aerial-note').textContent = aerialAvailable ? `已有同範圍授權${imageryLabel}可下載；樓高等限制仍使本模型屬部分成果。` : '尚無已驗證航照；不是完整基地模型。';
    if(state.siteOptions.aerialMode==='private-photo2') $('model-aerial-note').textContent = jobFlow.job?.coverage?.privateAerialEmbedded && current ? '官方航照已內嵌 SKP，原生重開驗證通過；不提供獨立影像下載。' : '生成時取得框選範圍的一張官方航照，並驗證內嵌；尚未完成前不宣稱已有貼圖。';
    const displayNotice = state.provider!=='google'&&state.basemap==='nlsc-aerial'
      ? '國土測繪中心航照已接入顯示，可定位與框選；模型是否內嵌航照，依本次輸出選項與驗證結果。'
      : '上方顯示底圖只用於定位，與本區成果來源分開。';
    $('aerial-disclosure').textContent = (aerialAvailable ? satellite ? 'Sentinel-2 衛星影像，10m 原始解析度，非高解析航照。放大不增加地表細節；日期與來源依實際資料標記。' : '本次航照成果已依來源授權與影像資料驗證；日期與解析度依來源標記，未知不填造。' : syntheticAerial ? '收到合成測試影像；它不是航照，不會顯示為航空影像成果或開放航照下載。' : '尚無已驗證的航照匯出成果；日期、比例尺與來源依獨立成果資料標記，未知不填造。') + displayNotice;
    if(current && jobFlow.job?.coverage?.privateAerialEmbedded) {
      $('aerial-source').textContent='國土測繪中心 PHOTO2；已內嵌 SKP，保留來源標示。';
      $('download-aerial').textContent='航照已內嵌 SKP · 不提供獨立下載';
      $('aerial-disclosure').textContent='官方航照貼圖已通過原生存檔與重開驗證；拍攝日期與來源解析度未知，不填造。'+displayNotice;
    }
    $('job-state').textContent = ({ queued: '排隊中', running: '產生中', partial: '部分成果', succeeded: '完成', failed: '失敗' })[jobFlow.job?.status] || (jobFlow.submitting ? '送出中' : '尚未送出');
    renderProgress();
    $('refresh-job').hidden = !jobFlow.job;
    $('refresh-job').disabled = jobFlow.polling || jobFlow.submitting;
    if (jobFlow.job) {
      const bounds = jobFlow.job.bounds || jobFlow.requestBounds;
      const size = measureBounds(bounds);
      $('job-range').textContent = `任務範圍：${Math.round(size.widthM)} × ${Math.round(size.depthM)} m；W ${bounds.west} / S ${bounds.south} / E ${bounds.east} / N ${bounds.north}${!current || !confirmed ? '。目前範圍已改變或尚未確認，下載暫停。' : ''}`;
    } else $('job-range').textContent = '';
    if (!enabled) $('export-state').textContent = '本功能使用需管理員開通';
    else if (complete) $('export-state').textContent = aerialAvailable ? `部分 SKP 與授權${imageryLabel}可用；請一併閱讀成果報告` : '部分 SKP 可用；尚無可下載的授權航照，請一併閱讀成果報告';
    if (complete && jobFlow.job?.coverage?.privateAerialEmbedded) $('export-state').textContent='部分 SKP 已含航照貼圖；請一併閱讀成果報告';
    else if (confirmed && !complete) $('export-state').textContent = reliefBlocked ? RELIEF_COVERAGE_MESSAGE : '已確認範圍；請確認部分成果限制後送出';
  }
  // Stage reported by the worker → [label, fallback %, step index (0 排隊 … 4 回傳成果, 5 = all done)]
  const SITE_STAGES = { queued: ['排隊中', 0, 0], leased: ['準備資料', 5, 1], preparing: ['準備資料', 5, 1],
    'checking-local-desktop': ['準備資料', 8, 1], 'checking-terrain-coverage': ['準備資料', 8, 1], 'preparing-private-aerial': ['取得官方航照', 15, 1],
    'fetching-osm': ['取得建物與道路資料', 30, 1], 'fetching-data': ['取得資料', 20, 1], 'building-geometry': ['建立量體與街廓', 45, 2],
    modeling: ['SketchUp 建模中', 55, 3], 'exporting-and-reopening-skp': ['SketchUp 建模與驗證', 65, 3], 'partial-result-verified': ['模型驗證完成', 90, 4],
    uploading: ['回傳成果', 95, 4], completed: ['完成', 100, 5] };
  function renderProgress() {
    const job = jobFlow.job, box = $('site-progress');
    if (!job || job.status === 'failed') { box.hidden = true; return; }
    const done = ['partial', 'succeeded'].includes(job.status);
    const [label, fallback, step] = done ? SITE_STAGES.completed : SITE_STAGES[job.stage] || (job.status === 'queued' ? SITE_STAGES.queued : ['建模處理中', 50, 3]);
    const reported = Number(job.progress_percent);
    const percent = done ? 100 : Math.max(0, Math.min(99, reported > 0 ? Math.max(reported, fallback) : fallback));
    const started = Number(job.created_at) > 0 ? Number(job.created_at) * 1000 : jobFlow.startedAt;
    const seconds = started ? Math.max(0, Math.round(((done && job.completed_at ? job.completed_at * 1000 : Date.now()) - started) / 1000)) : 0;
    const elapsed = seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
    box.hidden = false; box.classList.toggle('queued', job.status === 'queued');
    $('site-progress-label').textContent = job.status === 'queued' && job.queue_position ? `排隊中（第 ${job.queue_position} 位）` : label;
    $('site-progress-meta').textContent = `${percent}%${started ? ` · ${done ? '共' : '已經過'} ${elapsed}` : ''}`;
    $('site-progress-fill').style.width = percent + '%';
    $('site-progress-track').setAttribute('aria-valuenow', String(percent));
    [...$('site-progress-steps').children].forEach((li, i) => { li.classList.toggle('done', i < step); li.classList.toggle('active', i === step); });
  }
  async function pollJob() {
    if (!jobFlow.job || jobFlow.polling || state.destroyed) return;
    const id = jobFlow.job.id;
    clearTimeout(jobFlow.timer); jobFlow.polling = true; update();
    try {
      const job = await adapters.jobs.get(id);
      if (state.destroyed || id !== jobFlow.job?.id) return;
      jobFlow.job = job; jobFlow.failures = 0; jobFlow.coverage = job.coverage || jobFlow.coverage; showCoverage(jobFlow.coverage);
      const messages = { queued: '任務已排隊，等待建模服務處理。', running: '正在取得資料並建立 SketchUp 模型；可保留此頁等候。', partial: '已產生部分成果，正在核對可下載檔案；樓高與地形等限制請查看成果報告。', succeeded: '建模已完成；只開放已驗證的實際檔案下載。', failed: `任務失敗：${job.error?.message || job.error?.code || '請稍後重試，或聯繫管理員。'}` };
      status('job-status', messages[job.status] || '正在讀取任務狀態。', job.status === 'failed' ? 'error' : job.status === 'partial' ? 'warning' : '');
      $('job-stage').textContent = job.queue_position ? `共同佇列：第 ${job.queue_position} 位（A10-V1／A10-Site）` : '';
      if (['partial', 'succeeded'].includes(job.status)) {
        jobFlow.manifest = await adapters.downloads.get(id);
        if (state.destroyed || id !== jobFlow.job?.id) return;
        if (job.status === 'partial') status('job-status', artifactUrl('aerial') ? `已產生部分成果與經驗證的授權${jobFlow.manifest.artifacts.aerial.metadata?.imageryKind === 'satellite' ? '衛星影像' : '航照圖'}；樓高與地形等限制仍請查看成果報告。` : job.coverage?.privateAerialEmbedded ? '已產生含航照貼圖的部分 SKP；估高、街廓與地形限制請查看成果報告。' : '已產生部分成果；尚無可下載的授權航照，樓高與地形等限制請查看成果報告。', 'warning');
        if (!artifactUrl('model')) status('job-status', '任務回報完成，但沒有可驗證的 SKP 下載檔案；請檢查成果報告或重新整理狀態。', 'error');
      } else jobFlow.manifest = null;
      root.dispatchEvent(new CustomEvent('aias:job-updated', { bubbles: true, detail: structuredClone(job) }));
      if (activeJob()) jobFlow.timer = setTimeout(pollJob, 2000);
    } catch (error) {
      if (state.destroyed) return;
      if (activeJob()) {
        // Keep following the job: a dropped or slow request must never end the automatic updates.
        jobFlow.failures = (jobFlow.failures || 0) + 1;
        const wait = Math.min(30000, 3000 * jobFlow.failures);
        status('job-status', `連線不穩，${Math.round(wait / 1000)} 秒後自動重試；任務仍在處理中，請勿重複送出。`, 'warning');
        jobFlow.timer = setTimeout(pollJob, wait);
      } else status('job-status', `無法取得任務狀態：${error.message || '請恢復連線後按重新整理。'} 任務可能仍在處理中，請勿重複送出。`, 'error');
    } finally { jobFlow.polling = false; update(); }
  }
  const update = () => {
    if (state.destroyed) return;
    const bounds = state.bounds;
    const validation = bounds ? validateBounds(bounds) : { valid: false, warnings: [], errors: [] };
    const generationError = generationRangeError(bounds, true);
    const limits = generationLimits();
    $('generation-limit').hidden = !limits;
    $('generation-limit').textContent = limits ? '模型生成上限：寬度、深度各 ' + number(limits.maxSideM) + ' 公尺；面積 ' + number(limits.maxAreaM2) + ' m²。' : '';
    for (const id of ['width-input', 'depth-input']) $(id).max = limits ? limits.maxSideM : 10000;
    const pendingMarker = state.selection.method === 'address' && !state.selection.markerConfirmed;
    const ready = Number.isFinite(state.siteOptions.fallbackHeightM) && state.siteOptions.fallbackHeightM>=1 && state.siteOptions.fallbackHeightM<=100 && Number.isFinite(state.siteOptions.floorHeightM) && state.siteOptions.floorHeightM >= 2 && state.siteOptions.floorHeightM <= 6 && validation.valid && !generationError && !pendingMarker && !state.drawing && !state.pendingEdits && !googleDerived() && !state.providerBusy;
    $('confirm-range').disabled = !ready || !!state.confirmedAt;
    $('export-json').disabled = !ready || !state.confirmedAt;
    $('apply-size').disabled = !bounds || state.drawing || !scopeVisible() || state.providerBusy;
    $('fit-btn').disabled = !bounds || !scopeVisible() || state.providerBusy;
    $('map-provider').disabled = state.providerBusy || !map;
    $('leaflet-basemap').disabled = state.providerBusy || !map || state.provider === 'google';
    $('search-btn').disabled = state.searching || state.providerBusy;
    $('draw-btn').disabled = !map || state.providerBusy;
    $('map-start-draw').disabled = !map || state.providerBusy;
    $('apply-bounds').disabled = state.providerBusy || !scopeVisible();
    $('export-restriction').hidden = !googleDerived();
    // Retain provider state privately, but do not display Google-derived
    // coordinates alongside the OSM map or without Google's attribution.
    $('range-form').hidden = !scopeVisible();
    root.querySelector('.range-panel .summary').hidden = !scopeVisible();
    root.querySelector('.range-panel .coordinates').hidden = !scopeVisible();
    $('clear-btn').disabled = !bounds && !state.selection.candidate && !state.drawing && !state.searching && !state.candidates.length;
    $('range-state').textContent = state.pendingEdits ? '待套用' : state.confirmedAt ? '已確認' : bounds ? '待確認' : '尚未選取';
    $('confirm-range').textContent = state.confirmedAt ? '✓ 基地範圍已確認' : '確認基地範圍 →';
    $('export-state').textContent = state.confirmedAt ? '範圍已確認，等待模型與航照服務接入' : '先確認基地範圍';
    $('range-warning').hidden = !(generationError || validation.warnings.length) || !scopeVisible();
    $('range-warning').textContent = [generationError, ...validation.warnings].filter(Boolean).join(' ');
    if (bounds) {
      const info = measureBounds(bounds);
      if (!state.pendingEdits) { $('width-input').value = Math.round(info.widthM); $('depth-input').value = Math.round(info.depthM); }
      $('area-value').replaceChildren(document.createTextNode(number(info.areaM2) + ' '));
      const unit = document.createElement('small'); unit.textContent = 'm²'; $('area-value').append(unit);
      $('center-value').textContent = `${info.center.lng.toFixed(6)}, ${info.center.lat.toFixed(6)}`;
      if (!state.pendingEdits) for (const name of ['west', 'south', 'east', 'north']) $(`${name}-input`).value = bounds[name].toFixed(7);
      status('range-status', state.drawing ? '正在框選；完成第二個角點後會替換原範圍。' : pendingMarker ? '先確認地址標記，再確認基地範圍。' : state.confirmedAt ? '範圍已確認。變更尺寸或重畫後，需再次確認。' : '尺寸與面積為球面近似值；模型與航照圖會共用此範圍。', state.confirmedAt ? 'success' : '');
    } else {
      $('area-value').textContent = '— m²'; $('center-value').textContent = '尚未選取';
      if (!state.pendingEdits) for (const name of ['west', 'south', 'east', 'north']) $(`${name}-input`).value = '';
      status('range-status', state.drawing ? '請在地圖點選矩形的兩個對角。' : '選取後，可調整尺寸或重畫範圍。');
    }
    $('marker-panel').hidden = !state.selection.candidate || state.selection.method !== 'address' || !scopeVisible();
    $('confirm-marker').disabled = state.selection.markerConfirmed;
    $('confirm-marker').textContent = state.selection.markerConfirmed ? '✓ 位置已確認' : '確認這個位置';
    if (state.pendingEdits) status('range-status', '欄位已編輯，請先套用尺寸或邊界座標，再確認範圍。');
    if (bounds) $('map-location-label').textContent = state.pendingEdits ? '欄位待套用｜地圖仍顯示原範圍' : pendingMarker ? '候選地址位置｜請確認標記' : state.confirmedAt ? '共同範圍已確認｜模型與航照圖' : '目前基地範圍｜請調整並確認';
    if (googleDerived()) status('range-status', scopeVisible() ? 'Google 地址僅供定位參考；請在地圖重新手動畫出自訂範圍，再確認及匯出。' : 'Google 定位範圍已保留，僅能在 Google 地圖檢視；也可在目前地圖重新框選。');
    if (!scopeVisible()) $('map-location-label').textContent = 'Google 定位範圍已保留｜目前地圖未顯示';
    map?.setBounds(scopeVisible() ? bounds : null, { confirmed: !!state.confirmedAt });
    if (generationError && scopeVisible()) { $('range-state').textContent = '超出生成上限'; $('confirm-range').textContent = '請先縮小範圍'; }
    updateJob(ready);
  };
  function changeBounds(bounds, { fit = false } = {}) {
    $('accept-partial').checked = false;
    const result = validateBounds(bounds);
    state.pendingEdits = false;
    if (!result.valid) { state.confirmedAt = null; update(); status('range-status', `${result.errors.join(' ')} 原範圍保留，請重新調整並確認。`, 'error'); return false; }
    state.bounds = bounds; state.confirmedAt = null;
    status('export-status', ''); update(); if (fit && scopeVisible()) map?.fit(bounds); return true;
  }
  function changeMode(mode) {
    state.mode = mode;
    $('mode-address').setAttribute('aria-pressed', String(mode === 'address'));
    $('mode-map').setAttribute('aria-pressed', String(mode === 'map'));
    $('address-panel').hidden = mode !== 'address'; $('map-mode-panel').hidden = mode !== 'map';
  }
  function startDrawing() { if (state.providerBusy) return; map?.setDrawing(true); $('map').focus({ preventScroll: true }); if (innerWidth < 850) $('map').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function showCandidates() {
    $('candidates').replaceChildren();
    state.candidates.forEach(candidate => {
      if (candidate.provider === 'google' && state.provider !== 'google') return;
      const button = document.createElement('button'); button.className = 'candidate'; button.dataset.candidateId = candidate.id;
      const label = document.createElement('span'); label.textContent = candidate.label;
      const note = document.createElement('small'); note.textContent = candidate.matchLevel === 'street' ? '路段級候選 · 非精確門牌 · 點選後請確認' : '候選位置 · 精確門牌未驗證 · 點選後請確認'; button.append(label, note);
      button.addEventListener('click', () => {
        if (state.providerBusy || (candidate.provider === 'google' && state.provider !== 'google')) return;
        const width = Number($('width-input').value) || 300, depth = Number($('depth-input').value) || 300;
        let bounds;
        try {
          bounds = boundsFromCenter(candidate, width, depth);
          if (!validateBounds(bounds).valid) bounds = boundsFromCenter(candidate, 300, 300);
          if (!validateBounds(bounds).valid) throw new Error('候選位置超出支援範圍。');
        } catch { status('search-status', '無法在此候選位置建立有效範圍，請改用地圖選取。', 'error'); return; }
        map?.setDrawing(false);
        state.selection = { method: 'address', query: state.resultQuery, candidate: { ...candidate }, markerConfirmed: false, provenance: candidate.provider === 'google' ? 'google-geocoding' : 'independent-geocoder' };
        $('marker-label').textContent = candidate.label;
        $('map-location-label').textContent = '候選地址位置｜請確認標記';
        map?.setMarker(candidate);
        changeBounds(bounds, { fit: true });
        for (const item of $('candidates').children) item.classList.toggle('selected', item === button);
      });
      $('candidates').append(button);
    });
  }
  listen($('address-form'), 'submit', async event => {
    event.preventDefault();
    if (state.searching || state.providerBusy) return;
    const query = $('address-input').value.trim();
    if (query.length < 2) { status('search-status', '請輸入至少兩個字的地址或地標。', 'error'); return; }
    if (!navigator.onLine) { status('search-status', '目前離線，請恢復網路後再搜尋。', 'error'); return; }
    state.searching = true; const version = ++state.queryVersion; requestController = new AbortController();
    $('search-btn').disabled = true; $('search-btn').textContent = '搜尋中';
    status('search-status', '正在查詢候選位置，請稍候…'); update();
    try {
      const result = await activeGeocoder.search(query, { signal: requestController.signal });
      if (version !== state.queryVersion || state.destroyed) return;
      state.candidates = result.candidates.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && Math.abs(item.lat) <= 85 && Math.abs(item.lng) <= 180).map(item => ({ ...item, provider: item.provider || result.provider, precision: 'unverified', requiresConfirmation: true }));
      state.resultQuery = query; showCandidates();
      status('search-status', state.candidates.length ? `找到 ${state.candidates.length} 個候選。請點選並確認位置。` : '找不到這個地址。可移除郵遞區號／里名後手動重試，或切換地圖框選；不會推測門牌座標。');
    } catch (error) {
      if (version !== state.queryVersion || error.name === 'AbortError' || state.destroyed) return;
      state.candidates = []; showCandidates(); status('search-status', `地址服務暫時無法使用。${error.message || '請稍後再試，或使用地圖框選。'}`, 'error');
    } finally {
      if (version === state.queryVersion && !state.destroyed) { state.searching = false; $('search-btn').disabled = false; $('search-btn').textContent = '搜尋'; update(); }
    }
  });
  listen($('mode-address'), 'click', () => changeMode('address'));
  listen($('mode-map'), 'click', () => changeMode('map'));
  listen($('load-dataset-range'), 'click', () => {
    const bounds = config?.experimentalLocalWorker?.dataset?.demoBounds;
    if (!map || state.providerBusy || !validateBounds(bounds).valid) return;
    requestController?.abort(); state.queryVersion++; state.searching = false; state.candidates = [];
    $('search-btn').textContent = '搜尋'; status('search-status', '');
    map.setDrawing(false);
    state.selection = { method: 'map', query: '', candidate: null, markerConfirmed: false, provenance: 'user-authored' };
    map.setMarker(null); changeMode('map'); showCandidates(); changeBounds(structuredClone(bounds), { fit: true });
    $('map-location-label').textContent = '已載入獨立資料集示範範圍｜請檢視並確認';
    root.dispatchEvent(new CustomEvent('aias:dataset-range-loaded', { bubbles: true, detail: { datasetId: config.experimentalLocalWorker.dataset.id, bounds: structuredClone(bounds) } }));
  });
  listen($('confirm-marker'), 'click', () => { if (!state.selection.candidate) return; state.selection.markerConfirmed = true; state.confirmedAt = null; $('map-location-label').textContent = '使用者已確認地址標記｜仍需確認基地範圍'; update(); });
  listen($('draw-btn'), 'click', startDrawing); listen($('map-start-draw'), 'click', startDrawing);
  listen($('cancel-draw'), 'click', () => map?.setDrawing(false));
  listen($('fit-btn'), 'click', () => { if (state.bounds && scopeVisible()) map?.fit(state.bounds); });
  listen($('clear-btn'), 'click', () => {
    requestController?.abort(); state.queryVersion++; state.searching = false;
    $('search-btn').disabled = false; $('search-btn').textContent = '搜尋';
    state.bounds = null; state.confirmedAt = null; state.pendingEdits = false; state.selection = { method: 'map', query: '', candidate: null, markerConfirmed: false, provenance: 'user-authored' }; state.candidates = [];
    map?.setDrawing(false); map?.setMarker(null); showCandidates(); update();
    $('map-location-label').textContent = '範圍已清除｜目前地圖視野保留'; status('search-status', '範圍與候選已清除，可重新搜尋或框選。'); status('export-status', '');
  });
  listen($('range-form'), 'submit', event => {
    event.preventDefault(); if (!state.bounds || !scopeVisible() || state.providerBusy) return;
    try { changeBounds(boundsFromCenter(measureBounds(state.bounds).center, Number($('width-input').value), Number($('depth-input').value)), { fit: true }); }
    catch (error) { status('range-status', error.message, 'error'); }
  });
  for (const name of ['width', 'depth', 'west', 'south', 'east', 'north']) listen($(`${name}-input`), 'input', () => {
    editedRangeKind = ['width', 'depth'].includes(name) ? 'size' : 'coordinates';
    state.pendingEdits = true; state.confirmedAt = null; status('export-status', ''); update();
  });
  listen($('apply-bounds'), 'click', () => {
    if (!scopeVisible() || state.providerBusy) return;
    const bounds = {}; for (const name of ['west', 'south', 'east', 'north']) bounds[name] = $(`${name}-input`).value === '' ? NaN : Number($(`${name}-input`).value);
    if (!validateBounds(bounds).valid) { status('range-status', validateBounds(bounds).errors.join(' '), 'error'); return; }
    const provenance = googleDerived() ? 'google-geocoding' : 'user-authored';
    map?.setDrawing(false); state.selection = { method: 'map', query: '', candidate: null, markerConfirmed: false, provenance }; map?.setMarker(null); changeBounds(bounds, { fit: true }); $('map-location-label').textContent = '手動邊界座標｜請確認範圍';
  });
  listen($('confirm-range'), 'click', () => {
    if (googleDerived() || state.providerBusy) return;
    if (!state.bounds || generationRangeError(state.bounds) || state.drawing || state.pendingEdits || !validateBounds(state.bounds).valid || (state.selection.method === 'address' && !state.selection.markerConfirmed)) return;
    state.confirmedAt ||= new Date().toISOString(); update();
    root.dispatchEvent(new CustomEvent('aias:range-confirmed', { bubbles: true, detail: buildRequest(state) }));
  });
  listen($('export-json'), 'click', () => {
    if (googleDerived() || state.providerBusy) return;
    if (!state.confirmedAt || state.drawing || state.pendingEdits) return;
    try {
      const request = buildRequest(state); const blob = new Blob([JSON.stringify(request, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'aias-site-request.json'; root.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onRequest?.(request); root.dispatchEvent(new CustomEvent('aias:request-exported', { bubbles: true, detail: request }));
      status('export-status', '已匯出範圍請求 JSON（非 SKP 模型），尚未建立生成任務。', 'success');
    } catch (error) { status('export-status', error.message, 'error'); }
  });
  for (const [id,key] of [['building-mode','buildingMode'],['floor-height','floorHeightM'],['fallback-height','fallbackHeightM'],['aerial-mode','aerialMode'],['context-mode','contextMode'],['block-material','blockMaterial']]) listen($(id), ['floor-height','fallback-height'].includes(id)?'input':'change', () => {
    state.siteOptions[key]=['floor-height','fallback-height'].includes(id)?Number($(id).value):$(id).value;
    state.confirmedAt=null; $('accept-partial').checked=false; update();
  });
  listen($('terrain-mode'), 'change', () => {
    state.terrainMode=$('terrain-mode').value;
    state.confirmedAt=null; $('accept-partial').checked=false;
    $('terrain-mode-note').textContent=state.terrainMode==='flat' ? '忽略地勢，所有建物基底使用 Z=0；地面使用最小平面，不含密集地形網格。' : '保留來源地形起伏，隱藏內部三角網格線；高程不是基地實測。目前只涵蓋臺北市。';
    update();
  });
  listen($('accept-partial'), 'change', update);
  listen($('refresh-job'), 'click', pollJob);
  // Background tabs throttle timers; catch up as soon as the page is visible again.
  listen(document, 'visibilitychange', () => { if (!document.hidden && activeJob() && !jobFlow.polling) pollJob(); });
  listen($('generate-skp'), 'click', async () => {
    if ($('generate-skp').disabled || jobFlow.submitting || activeJob() || googleDerived()) return;
    let request;
    try { request = buildRequest(state); } catch (error) { status('job-status', error.message, 'error'); return; }
    const key = JSON.stringify({bounds:request.bounds,requestedOutputs:request.requestedOutputs});
    if (key !== jobFlow.requestKey || jobFlow.job?.status === 'failed') {
      jobFlow.requestKey = key; jobFlow.idempotencyKey = crypto.randomUUID();
      if (jobFlow.job?.status === 'failed') jobFlow.job = null;
    }
    request.coverage = { ...request.coverage, acceptPartial: true, acceptedAt: new Date().toISOString(), acceptedLimitations: config?.experimentalLocalWorker?.dataset?.id ? ['source-height-requires-current-verification', 'missing-heights-not-invented', 'road-boundaries-unverified', 'historical-terrain-source-resolution', 'unverified-aerial-omitted'] : ['unverified-osm-height', 'missing-heights-not-invented', 'roads-centerlines-only', 'terrain-20m-coarse', 'unverified-aerial-omitted'] };
    jobFlow.submitting = true; jobFlow.manifest = null;
    status('job-status', '正在檢查範圍與資料限制…'); update();
    try {
      const coverage = await adapters.coverage.check({ request });
      if (state.destroyed) return;
      jobFlow.coverage = coverage; showCoverage(coverage);
      if (!state.confirmedAt || state.pendingEdits || state.drawing || googleDerived() || !sameBounds(state.bounds, request.bounds) || state.terrainMode !== request.requestedOutputs.terrainMode || JSON.stringify(state.siteOptions)!==JSON.stringify(request.requestedOutputs.siteOptions) || !$('accept-partial').checked) throw new Error('範圍或同意狀態已改變；請重新確認後再送出。');
      if (!['partial', 'available', 'ready', 'complete'].includes(coverage.status)) throw new Error('此範圍目前無法開始建模。');
      status('job-status', '已確認部分成果限制，正在送出建模任務…');
      const job = await adapters.jobs.create({ request, acceptPartial: true, idempotencyKey: jobFlow.idempotencyKey });
      if (state.destroyed) return;
      if (!job.id || !['queued', 'running', 'partial', 'succeeded', 'failed'].includes(job.status)) throw new Error('建模服務回傳的任務資料不完整。');
      jobFlow.job = job; jobFlow.startedAt = Date.now(); jobFlow.requestBounds = structuredClone(request.bounds);
      status('job-status', '任務已建立，正在讀取狀態。');
      await pollJob();
    } catch (error) { if (!state.destroyed) status('job-status', `無法開始建模任務：${error.message || '請檢查連線後重試。'}`, 'error'); }
    finally { jobFlow.submitting = false; update(); }
  });
  for (const [id, type] of [['download-skp', 'model'], ['download-report', 'report'], ['download-aerial', 'aerial']]) listen($(id), 'click', async () => {
    if ($(id).disabled || googleDerived() || !state.confirmedAt || state.pendingEdits || state.drawing || !matchesJob()) return;
    const url = artifactUrl(type); if (!url) return;
    let downloadUrl=url;
    try { if(adapters.downloads.fetch)downloadUrl=URL.createObjectURL(await adapters.downloads.fetch(jobFlow.job.id,type)); }
    catch(error){if(!state.destroyed)status('job-status',error.message,'error');return;}
    if(state.destroyed || root.inert){if(downloadUrl.startsWith('blob:'))URL.revokeObjectURL(downloadUrl);return;}
    const anchor = document.createElement('a'); anchor.href = downloadUrl; anchor.download = jobFlow.manifest.artifacts[type].filename || '';
    if(downloadUrl.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(downloadUrl),60000);
    root.append(anchor); anchor.click(); anchor.remove();
  });
  const network = () => { $('network-banner').hidden = navigator.onLine; if (!navigator.onLine) { $('map-loading').hidden = true; $('map-error').hidden = false; } };
  listen(window, 'online', network); listen(window, 'offline', network); network();
  try { config = await adapters.config.get(); } catch { status('search-status', '服務連線失敗，請重新整理或稍後重試。', 'error'); }
  if (state.destroyed) return;
  const mapCallbacks = {
      onSelect(bounds) {
        if (!validateBounds(bounds).valid) { changeBounds(bounds); return; }
        state.selection = { method: 'map', query: '', candidate: null, markerConfirmed: false, provenance: 'user-authored' }; map?.setMarker(null);
        changeBounds(bounds); $('map-location-label').textContent = '地圖框選範圍｜可調整尺寸';
      },
      onMarkerMove(point) {
        if (!state.selection.candidate) return;
        const previous = state.selection.candidate; const info = state.bounds ? measureBounds(state.bounds) : { widthM: 300, depthM: 300 };
        let bounds;
        try {
          bounds = boundsFromCenter(point, info.widthM, info.depthM);
          if (!validateBounds(bounds).valid) throw new Error('無效標記位置');
        } catch { map?.setMarker(previous); status('range-status', '標記超出支援範圍，已保留原位置。', 'error'); return; }
        state.selection.candidate = { ...previous, ...point, userAdjusted: true, originalLocation: previous.originalLocation || { lat: previous.lat, lng: previous.lng } };
        state.selection.markerConfirmed = false;
        $('marker-label').textContent = `${previous.label}（標記已手動調整，請重新確認）`;
        changeBounds(bounds);
      },
      onDrawState(active, hasFirst) { state.drawing = active; if (active) state.pendingEdits = false; $('draw-hint').hidden = !active; $('draw-btn').setAttribute('aria-pressed', String(active)); $('draw-instruction').textContent = hasFirst ? '再點選另一個對角，完成範圍' : '點選第一個角點'; update(); },
      onDrawError(message) { $('draw-instruction').textContent = message; },
      onLoading() { $('map-loading').textContent=state.provider==='google'?'載入 Google 地圖中…':state.basemap==='nlsc-aerial'?'載入國土測繪中心正射影像中…':'載入 OSM 街道圖中…'; $('map-loading').hidden = false; $('map-error').hidden=true; },
      onLoaded(success) { $('map-loading').hidden = true; $('map-error').hidden = success && !(state.provider === 'google' && googleFailure);
        if(state.provider!=='google'&&success)status('provider-status',state.basemap==='nlsc-aerial'
          ?'國土測繪中心正射影像已載入，可定位與框選；地址搜尋仍使用 Photon，本次未接影像匯出。'
          :'OSM 街道圖已載入；範圍與地址標記保留。','success');
      },
      onTileError() { $('map-loading').hidden = true; $('map-error').hidden = false;
        $('map-error').querySelector('span').textContent=state.provider!=='google'&&state.basemap==='nlsc-aerial'
          ?'國土測繪中心正射影像載入失敗或此處無資料。未改用街道圖；已選範圍仍保留，可重試或自行切換底圖。'
          :'地圖未能載入。請確認網路；已選範圍仍會保留。';
        if(state.provider!=='google')status('provider-status',state.basemap==='nlsc-aerial'
          ?'國土測繪中心正射影像載入失敗，未自動改用街道圖；範圍保留，可重試。':'OSM 街道圖載入失敗；範圍保留，可重試。','error');
      },
  };
  function createMap(provider, maps) {
    map?.setDrawing(false); map?.destroy(); map = null;
    $('map').replaceChildren(); $('map').className = mapClass; $('map').style.cssText = mapStyle;
    state.provider = provider;
    renderBasemap();
    map = provider === 'google'
      ? googleMapFactory($('map'), { maps }, mapCallbacks)
      : mapFactory($('map'), leafletConfig(), mapCallbacks);
    activeGeocoder = provider === 'google' ? googleServices.geocoder : adapters.geocoder;
    $('map-provider').value = provider;
    $('geocoder-notice').textContent = provider === 'google'
      ? '按下搜尋才會將地址送至 Google Maps；不會自動完成或批量查詢。Google 候選只在 Google 地圖顯示，正式輸出使用獨立授權資料。'
      : '按下搜尋才會將地址送至 Photon（komoot）。不會自動完成或批量查詢。';
    map.setMarker(scopeVisible() ? state.selection.candidate : null);
    if (state.bounds && scopeVisible()) map.fit(state.bounds);
    else if (!state.bounds && validateBounds(config?.experimentalLocalWorker?.dataset?.demoBounds).valid) {
      map.fit(config.experimentalLocalWorker.dataset.demoBounds);
      $('map-location-label').textContent = '資料集示範視窗｜尚未選取範圍，可按「載入示範範圍」';
    }
    showCandidates(); update();
  }
  async function changeProvider(provider) {
    if (state.providerBusy || state.destroyed) return;
    if (provider !== 'google' && provider !== 'osm') return;
    if (provider === 'google' && !config?.googleMaps?.apiKey?.trim()) {
      $('map-provider').value = state.provider;
      status('provider-status', 'Google Maps 尚未設定金鑰；目前保留原底圖與 Photon 地址服務。設定方式請見 docs/GOOGLE-MAPS-SETUP.md。', 'error');
      return;
    }
    const previous = state.provider;
    state.providerBusy = true; requestController?.abort(); state.queryVersion++; state.searching = false;
    $('search-btn').textContent = '搜尋'; status('search-status', '');
    status('provider-status', provider === 'google' ? '正在載入官方 Google Maps…' : '正在切換底圖與 Photon 地址服務…'); update();
    try {
      let maps;
      if (provider === 'google') {
        if (!googleServices) {
          googleServices = googleServicesFactory({ googleConfig: config.googleMaps });
          removeGoogleError = googleServices.onError(error => {
            if (state.destroyed) return;
            googleFailure = true; status('provider-status', error.message, 'error');
            if (state.provider === 'google') { $('map-loading').hidden = true; $('map-error').hidden = false; }
          });
        }
        googleFailure = false; maps = await googleServices.load();
        if (state.destroyed) return;
      }
      createMap(provider, maps);
      status('provider-status', provider === 'google' ? '已載入 Google Maps 程式；底圖與查詢依金鑰、網路及專案設定運作。' : state.basemap==='nlsc-aerial'?'使用國土測繪中心正射影像顯示與 Photon 地址搜尋；範圍與輸入保留。':'使用 OpenStreetMap / Photon；範圍與輸入保留。');
    } catch (error) {
      if (state.destroyed) return;
      // Loading failure leaves the existing map intact. Constructor failure
      // restores the old provider so a failed switch never strands the UI.
      if (!map) {
        try { createMap(previous, previous === 'google' ? await googleServices.load() : undefined); }
        catch { try { createMap('osm'); } catch { /* Manual coordinate input remains available. */ } }
      }
      $('map-provider').value = state.provider;
      status('provider-status', `${error.message || '地圖服務無法載入。'} 目前保留原有範圍，可選擇其他服務。`, 'error');
    } finally { if (!state.destroyed) { state.providerBusy = false; update(); } }
  }
  try {
    createMap('osm');
    if (config?.googleMaps?.apiKey?.trim()) $('map-provider').options[1].textContent = 'Google Maps';
  } catch (error) { $('map-loading').hidden = true; $('map-error').hidden = false; $('map-error').querySelector('span').textContent = error.message; $('draw-btn').disabled = true; $('map-start-draw').disabled = true; }
  listen($('map-provider'), 'change', () => changeProvider($('map-provider').value));
  listen($('leaflet-basemap'),'change',()=>{
    const next=$('leaflet-basemap').value;
    if(state.provider==='google'||state.providerBusy||!map||!['osm','nlsc-aerial'].includes(next)||next===state.basemap)return;
    if(next==='nlsc-aerial'&&!nlscConfigured()){$('leaflet-basemap').value=state.basemap;status('provider-status','國土測繪中心航照顯示尚未設定。','error');return;}
    state.basemap=next;renderBasemap();
    status('provider-status',next==='nlsc-aerial'?'已選國土測繪中心正射影像，正在載入；僅供定位顯示，地址搜尋仍使用 Photon。':'正在載入 OSM 街道圖；範圍與地址標記保留。');
    try{map.setBasemap(leafletConfig());}
    catch(error){mapCallbacks.onTileError();status('provider-status',`底圖切換失敗：${error.message||'請重試。'} 未自動改用其他來源。`,'error');}
    update();
  });
  listen($('retry-map'), 'click', () => { if (state.provider === 'google' && googleFailure) changeProvider('google'); else map?.retry(); }); update();
  return {
    refreshConfiguration: () => update(),
    getRequest: () => buildRequest(state),
    getState: () => structuredClone({ mode: state.mode, provider: state.provider, basemap: state.basemap, bounds: state.bounds, selection: state.selection, confirmedAt: state.confirmedAt }),
    destroy() { state.destroyed = true; clearTimeout(jobFlow.timer); requestController?.abort(); listeners.forEach(remove => remove()); removeGoogleError?.(); googleServices?.dispose(); map?.destroy(); },
  };
}

