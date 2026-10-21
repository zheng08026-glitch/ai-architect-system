/* Additive A2 forms and comparison. Prompt defaults come verbatim from the supplied graphs. */
window.AIAS_A2_PLUS = (() => {
  const presets = window.AIAS_A2_PLUS_PRESETS;
  const drafts = new Map();
  let revision = 0;
  let urls = [];
  let controller;
  let resultRevision = 0;
  let viewContext;
  let viewOwner = '';
  function clearComparison() {
    const host = document.getElementById('a2PlusResults');
    if (host) { host.hidden = true; host.replaceChildren(); }
  }
  function resetView() {
    revision += 1;
    resultRevision += 1;
    controller?.abort();
    clearComparison();
    viewContext?.clear();
    viewContext = undefined;
    viewOwner = '';
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
  }
  function refreshAccess(owner) { if (viewOwner && viewOwner !== owner) resetView(); }
  function state(id) {
    if (!drafts.has(id)) {
      const p = presets[id];
      drafts.set(id, {preset: 1, rules: p.rules, material: p.material, camera: p.camera,
        count: p.default_count, texts: p.presets.map(item => item.text), key: '', fingerprint: ''});
    }
    return drafts.get(id);
  }
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function textarea(parent, label, name, value, changed, help = '') {
    const box = el('div', '', 'field-box');
    const title = el('label', label); title.htmlFor = `a2plus-${name}`;
    const area = el('textarea'); area.id = title.htmlFor; area.value = value; area.maxLength = 6000;
    area.rows = 5; area.addEventListener('input', () => changed(area.value));
    box.append(title, area);
    if (help) box.append(el('small', help));
    parent.append(box);
    return area;
  }
  function renderInputs(id, parent, upload, submit) {
    const p = presets[id], draft = state(id);
    parent.replaceChildren(); parent.classList.remove('multi-image-inputs');
    parent.append(el('h3', '1. 輸入圖片', 'a2plus-step'), upload);
    parent.append(el('h3', p.floor ? '2. 選擇風格' : '2. 選擇光線', 'a2plus-step'));
    const box = el('div', '', 'field-box');
    const label = el('label', p.floor ? '風格' : '光線'); label.htmlFor = 'a2plus-preset';
    const select = el('select'); select.id = label.htmlFor;
    p.presets.forEach((preset, i) => { const option = el('option', preset.label); option.value = i + 1; select.append(option); });
    select.value = draft.preset; box.append(label, select); parent.append(box);
    const area = textarea(parent, '目前選擇的提詞（可修改）', 'preset-prompt', draft.texts[draft.preset - 1], value => { draft.texts[draft.preset - 1] = value; });
    select.addEventListener('change', () => { draft.preset = Number(select.value); area.value = draft.texts[draft.preset - 1]; });
    parent.append(el('h3', '3. 共用規則・目前提詞內容（可修改）', 'a2plus-step'));
    textarea(parent, 'A 共用規則', 'rules', draft.rules, value => { draft.rules = value; });
    if (!p.floor) {
      textarea(parent, 'B 材質', 'material', draft.material, value => { draft.material = value; }, '依本次設計調整材質。');
      textarea(parent, 'C 攝影語言', 'camera', draft.camera, value => { draft.camera = value; }, '可調整鏡頭、質感與攝影描述。');
    }
    const countBox = el('div', '', 'field-box'); const countLabel = el('label', '4. 輸出張數'); countLabel.htmlFor = 'a2plus-count';
    const count = el('select'); count.id = countLabel.htmlFor;
    for (const n of [1, 6]) { const option = el('option', `${n} 張`); option.value = n; count.append(option); }
    count.value = draft.count; count.addEventListener('change', () => { draft.count = Number(count.value); });
    countBox.append(countLabel, count);
    if (p.floor) countBox.append(el('small', '每張成果可查看「AI 原始上色」與「線稿疊回版」。'));
    parent.append(countBox, el('h3', '5. 送出資訊', 'a2plus-step'));
    const button = el('button', 'AI生成圖說', 'generate-button'); button.type = 'button'; button.addEventListener('click', () => submit(button));
    parent.append(button, el('p', '每次送出使用 A1–A8 共用額度 1 次。AI 成果可能有錯誤或變形，請比對原圖後使用。', 'generation-notice'));
  }
  function publicError(response, body) {
    if (response.status === 401) return '請先登入有效的會員帳號。';
    if (response.status === 403) return '此帳號目前無法使用，請確認會員狀態或額度。';
    if (response.status === 429) return '目前可用額度不足，請至會員中心確認。';
    if (response.status === 503 || response.status === 404) return '新工作項目尚在準備中，請稍後再試。';
    if (body?.detail?.error_type === 'input') return '輸入錯誤，請確認圖片、提詞長度與輸出張數後再試。';
    return '系統暫時無法完成此操作，請稍後再試。';
  }
  async function jsonFetch(url, options) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    options.signal?.addEventListener('abort', cancel, {once: true});
    if (options.signal?.aborted) abort.abort();
    const timer = setTimeout(cancel, 20000);
    try {
      const response = await fetch(url, {...options, signal: abort.signal});
      const body = await response.json();
      if (!response.ok) throw new Error(publicError(response, body));
      return body;
    } catch (error) {
      if (abort.signal.aborted && !options.signal?.aborted) throw new Error('連線逾時，可用相同內容重試，或從會員任務紀錄查看。');
      if (error instanceof SyntaxError) throw new Error('系統回覆暫時無法讀取，請稍後重試。');
      throw error;
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
  }
  async function submit(id, file, context, button) {
    if (!context.token()) { context.login(); return; }
    if (!file) { context.error('請先上傳圖片。'); return; }
    const draft = state(id);
    if (!draft.rules.trim() || !draft.texts[draft.preset - 1].trim()) { context.error('請填寫共用規則及光線／風格提詞。'); return; }
    resetView();
    viewContext = context; viewOwner = context.owner();
    context.clear();
    const version = revision, token = context.token();
    const current = () => revision === version && context.token() === token;
    const abort = new AbortController(); controller = abort;
    const options = {headers: {Authorization: `Bearer ${token}`}, signal: abort.signal};
    button.disabled = true;
    try {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), n => n.toString(16).padStart(2, '0')).join('');
      const fields = {system_id: id, count: draft.count, preset: draft.preset, rules: draft.rules, material: draft.material, camera: draft.camera, preset_prompt: draft.texts[draft.preset - 1]};
      const fingerprint = JSON.stringify({hash, ...fields});
      if (draft.fingerprint !== fingerprint || !draft.key) { draft.key = crypto.randomUUID(); draft.fingerprint = fingerprint; }
      const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append('image', file); form.append('request_key', draft.key);
      if (!current()) return;
      context.progress({stage: 'analyzing', stage_label: '分析使用者提供資訊', progress_percent: 8});
      const accepted = await jsonFetch(`${context.base()}/api/a2-plus/jobs`, {...options, method: 'POST', body: form});
      let failures = 0;
      for (let attempt = 0; attempt < 900 && current(); attempt++) {
        let job;
        try {
          job = await jsonFetch(`${context.base()}/api/jobs/${accepted.job_id}`, options);
          failures = 0;
        } catch (error) {
          if (error.name === 'AbortError' || ++failures >= 4) throw error;
        }
        if (!current()) return;
        if (job?.status === 'completed') { draft.key = ''; await context.results(job); await context.refresh(); return; }
        if (job?.status === 'failed') { draft.key = ''; throw new Error(job.error_type === 'input' ? '任務未完成：輸入錯誤，請檢查圖片與提詞。' : '任務未完成：系統錯誤，請稍後再試。'); }
        if (job) context.progress(job);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (current()) throw new Error('任務仍在處理中，請稍後從會員任務紀錄查看成果。');
    } catch (error) {
      if (current() && error.name !== 'AbortError') context.error(error instanceof TypeError ? '連線中斷，可用相同內容重試，或從會員任務紀錄查看。' : error.message);
    } finally { if (current()) button.disabled = false; }
  }
  async function showResults(id, job, context) {
    const version = revision, resultVersion = ++resultRevision, token = context.token();
    const owner = context.owner();
    const viewCurrent = () => revision === version && resultVersion === resultRevision && owner === context.owner();
    const current = () => viewCurrent() && token === context.token();
    clearComparison();
    viewContext = context; viewOwner = context.owner();
    const created = [];
    try {
      const get = async path => {
        const response = await fetch(`${context.base()}${path}`, {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'});
        if (!response.ok) throw new Error('無法取得成果，請重新登入或從任務紀錄重試。');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('成果暫時無法顯示。');
        const url = URL.createObjectURL(blob); created.push(url); return url;
      };
      const record = await jsonFetch(`${context.base()}/api/jobs/${job.job_id}`, {headers: {Authorization: `Bearer ${token}`}});
      const original = await get(`/api/a2-plus/jobs/${job.job_id}/original`);
      const images = [];
      for (let index = 0; index < record.output_images.length; index++) images.push(await get(`/api/a2-plus/jobs/${job.job_id}/images/${index}`));
      if (!current()) { created.forEach(url => URL.revokeObjectURL(url)); return; }
      if (!images.length) throw new Error('任務完成，但沒有收到可顯示的成果。');
      const p = presets[id], batch = Number(record.count) || (p.floor ? images.length / 2 : images.length);
      if (!Number.isInteger(batch) || batch < 1 || images.length !== batch * (p.floor ? 2 : 1)) throw new Error('成果暫時無法完整顯示，請從任務紀錄重試。');
      const labels = images.map((_, i) => p.floor ? `${i < batch ? 'AI 原始上色' : '線稿疊回版'} ${i % batch + 1}` : `成果 ${i + 1}`);
      const originalImage = el('img'); originalImage.src = original;
      try { await originalImage.decode(); } catch { throw new Error('原圖暫時無法顯示，請從任務紀錄重試。'); }
      if (!current()) { created.forEach(url => URL.revokeObjectURL(url)); return; }
      urls.forEach(url => URL.revokeObjectURL(url)); urls = created;
      const host = context.comparison;
      const viewer = el('section', '', 'a2plus-viewer'); viewer.setAttribute('aria-label', `${p.label} 任務結果`);
      const toolbar = el('div', '', 'a2plus-result-heading');
      const heading = el('h3', '原圖與最終成果');
      const task = el('span', `任務 ${record.job_id || job.job_id}`, 'a2plus-job-id');
      const toggle = el('button', '切換疊圖比對', 'a2plus-button'); toggle.type = 'button';
      toolbar.append(heading, task, toggle);
      const selection = el('div', '', 'a2plus-result-selection');
      const picker = el('div', '', 'a2plus-result-picker'); picker.setAttribute('role', 'group'); picker.setAttribute('aria-label', '選擇成果');
      picker.hidden = batch === 1;
      let selectedResult = 0, selectedVariant = 0, comparisonMode = 'side';
      const resultButtons = [];
      for (let i = 0; i < batch; i++) {
        const button = el('button', '', 'a2plus-result-choice'); button.type = 'button';
        const image = el('img'); image.src = images[i]; image.alt = ''; image.loading = 'lazy';
        button.append(image, el('span', `成果 ${i + 1}`));
        button.addEventListener('click', () => { selectedResult = i; selectResult(); });
        resultButtons.push(button); picker.append(button);
      }
      const versions = el('div', '', 'a2plus-version-picker'); versions.setAttribute('role', 'group'); versions.setAttribute('aria-label', '成果版本');
      const versionButtons = p.floor ? ['AI 原始上色', '線稿疊回版'].map((label, i) => {
        const button = el('button', label, 'a2plus-button'); button.type = 'button';
        button.addEventListener('click', () => { selectedVariant = i; selectResult(); });
        versions.append(button); return button;
      }) : [];
      versions.hidden = !p.floor;
      selection.hidden = batch === 1 && !p.floor; selection.append(picker, versions);
      const side = el('div', '', 'a2plus-side');
      function panel(label, src) { const figure = el('figure'); const image = el('img'); image.src = src; image.alt = label; figure.append(el('figcaption', label), image); return figure; }
      const before = panel('本次送出的原圖', original), after = panel('最終成果', images[0]); side.append(before, after);
      const overlay = el('div', '', 'a2plus-overlay-comparison');
      const surface = el('div', '', 'a2plus-compare-surface');
      const ratio = originalImage.naturalWidth / originalImage.naturalHeight;
      surface.style.aspectRatio = `${originalImage.naturalWidth} / ${originalImage.naturalHeight}`;
      surface.style.maxWidth = `min(1100px, calc(min(72vh, 720px) * ${ratio}))`;
      const overlayAfter = el('img'); overlayAfter.src = images[0]; overlayAfter.alt = '最終成果疊圖'; overlayAfter.draggable = false;
      const overlayBefore = el('img', '', 'a2plus-overlay-original'); overlayBefore.src = original; overlayBefore.alt = '本次送出的原圖疊圖'; overlayBefore.draggable = false;
      const line = el('div', '', 'a2plus-divider'); line.setAttribute('aria-hidden', 'true');
      const handle = el('span', '', 'a2plus-handle'); handle.append(el('span', '←'), el('span', '→')); line.append(handle);
      const slider = el('input'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.step = 1; slider.value = 50;
      slider.setAttribute('aria-label', '原圖與成果分隔位置');
      const position = el('span', '', 'a2plus-position');
      const caption = el('p', '', 'a2plus-compare-caption'); caption.append(el('span', '拖曳分隔線，查看同一位置的修改前後。'), position);
      const originalLabel = el('span', '原始圖片', 'a2plus-compare-label original');
      const finalLabel = el('span', '最終成果', 'a2plus-compare-label final');
      surface.append(overlayAfter, overlayBefore, originalLabel, finalLabel, line, slider); overlay.append(surface, caption);
      function setPosition() {
        const value = Math.max(0, Math.min(100, Number(slider.value) || 0));
        surface.style.setProperty('--position', `${value}%`);
        position.textContent = `原圖 ${value}% ／ 成果 ${100 - value}%`;
        slider.setAttribute('aria-valuetext', `原圖顯示 ${value}%，成果顯示 ${100 - value}%`);
      }
      slider.addEventListener('input', setPosition); setPosition();
      function setMode(value) {
        comparisonMode = value;
        const isOverlay = value === 'overlay'; side.hidden = isOverlay; overlay.hidden = !isOverlay;
        toggle.setAttribute('aria-pressed', String(isOverlay));
        toggle.textContent = isOverlay ? '切換左右比對' : '切換疊圖比對';
      }
      toggle.addEventListener('click', () => setMode(comparisonMode === 'side' ? 'overlay' : 'side'));
      const controls = el('div', '', 'a2plus-result-controls');
      const download = el('a', '下載最終成果 PNG', 'a2plus-button a2plus-primary'); controls.append(download);
      if (images.length > 1) {
        const archive = el('button', '下載全部成果 ZIP', 'a2plus-button'); archive.type = 'button';
        archive.addEventListener('click', async () => {
          if (!viewCurrent()) return;
          archive.disabled = true;
          try { await context.downloadAll(archive, viewCurrent); if (viewCurrent()) archive.textContent = 'ZIP 已儲存'; }
          catch (error) { if (viewCurrent()) archive.textContent = error?.name === 'AbortError' ? '已取消下載' : '下載未完成，請重試'; }
          finally { if (viewCurrent()) { archive.disabled = false; setTimeout(() => { if (viewCurrent()) archive.textContent = '下載全部成果 ZIP'; }, 2400); } }
        });
        controls.append(archive);
      }
      const preview = el('img', '', 'a2plus-selected-preview');
      context.main.replaceChildren(preview); context.thumbs.replaceChildren();
      const jump = el('button', '查看原圖與成果比對', 'a2plus-preview-jump'); jump.type = 'button';
      const scrollToResults = () => host.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
      jump.addEventListener('click', scrollToResults); context.thumbs.append(jump);
      function selectResult() {
        const index = selectedResult + selectedVariant * batch, url = images[index], label = labels[index];
        after.querySelector('img').src = url; after.querySelector('img').alt = label;
        after.querySelector('figcaption').textContent = p.floor ? `最終成果・${label}` : batch > 1 ? `最終成果・${label}` : '最終成果';
        overlayAfter.src = url; overlayAfter.alt = `${label}疊圖`; finalLabel.textContent = p.floor ? (selectedVariant ? '線稿疊回版' : 'AI 原始上色') : '最終成果';
        preview.src = url; preview.alt = label;
        download.href = url; download.download = `${p.label}-${label}.png`;
        resultButtons.forEach((button, i) => { button.setAttribute('aria-pressed', String(i === selectedResult)); button.querySelector('img').src = images[i + selectedVariant * batch]; });
        versionButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selectedVariant)));
        context.select(url, index, images);
      }
      viewer.append(toolbar, selection, side, overlay, controls); host.replaceChildren(viewer); host.hidden = false;
      setMode('side'); selectResult(); scrollToResults();
    } catch (error) { created.forEach(url => URL.revokeObjectURL(url)); if (current()) context.error(error.message); }
  }
  return {presets, renderInputs, submit, showResults, resetView, refreshAccess};
})();
