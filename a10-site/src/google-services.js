/**
 * Official Google Maps JS / Geocoder ports. No credentials are discovered here:
 * the embedding operator must explicitly supply a restricted browser API key.
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api
 * https://developers.google.com/maps/documentation/javascript/geocoding
 */
let callbackSequence = 0;

function serviceError(code, message) {
  return Object.assign(new Error(message), { code });
}

function abortError() {
  return Object.assign(new Error('已取消地址查詢。'), { name: 'AbortError', code: 'ABORTED' });
}

function withSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    // The provider request may already exist; Google does not expose request
    // cancellation. Consume a later failure while withholding its stale result.
    promise.catch(() => {});
    return Promise.reject(abortError());
  }
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError()); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

const statusMessages = {
  OVER_QUERY_LIMIT: 'Google 地址查詢已達用量限制，請由管理者檢查配額後再手動重試。',
  REQUEST_DENIED: 'Google 拒絕地址查詢，請由管理者檢查 API 啟用、金鑰與網站限制設定。',
  INVALID_REQUEST: 'Google 無法處理這個地址查詢，請檢查輸入內容。',
  ERROR: 'Google 地址服務無法連線，請確認網路後再手動重試。',
  UNKNOWN_ERROR: 'Google 地址服務暫時發生錯誤，請稍後手動重試。',
};

function geocodeError(status) {
  const known = Object.hasOwn(statusMessages, status) ? status : 'UNKNOWN_ERROR';
  return serviceError(`GOOGLE_${known}`, statusMessages[known]);
}

function normalizeCandidate(result, index) {
  const location = result?.geometry?.location;
  const lat = typeof location?.lat === 'function' ? location.lat() : NaN;
  const lng = typeof location?.lng === 'function' ? location.lng() : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const value = type => components.find(component => component.types?.includes(type))?.long_name || null;
  const providerAddress = {
    houseNumber: value('street_number'), route: value('route'),
    locality: value('locality'), district: value('administrative_area_level_3'),
    administrativeArea: value('administrative_area_level_1'),
    postalCode: value('postal_code'), country: value('country'),
  };
  const types = Array.isArray(result.types) ? result.types : [];
  return {
    id: result.place_id || `google-candidate-${index}`,
    label: result.formatted_address || 'Google 地址候選（請確認位置）',
    lat, lng, provider: 'google', precision: 'unverified', requiresConfirmation: true,
    matchLevel: providerAddress.houseNumber ? 'house-number-present' : types.includes('route') ? 'street' : 'place',
    partialMatch: result.partial_match === true,
    locationType: result.geometry?.location_type || null,
    providerAddress,
  };
}

/**
 * Constructing this adapter performs no network/DOM action. Call load() only
 * after explicit provider selection. Search is for manual submissions only.
 * Results stay with the caller; this adapter stores no completed-result cache.
 */
export function createGoogleServices({ googleConfig = {}, windowRef = globalThis, documentRef = globalThis.document, timeoutMs = 15_000 } = {}) {
  let disposed = false, loadPromise = null, loadAttempt = null, canReuseHostMaps = true;
  let scriptElement = null, authFailure = null, authInstalled = false;
  let previousAuthFailure, pendingSearch = null;
  const errorListeners = new Set();
  const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000;
  const emitError = error => {
    for (const listener of errorListeners) {
      try { listener(error); } catch { /* A host listener must not hide provider failures. */ }
    }
  };
  const removeScript = () => {
    if (scriptElement) { scriptElement.onerror = null; scriptElement.remove(); scriptElement = null; }
  };
  const ownAuthFailure = () => {
    if (disposed) return;
    const error = serviceError('GOOGLE_AUTH_FAILURE', 'Google Maps 授權失敗，請由管理者檢查金鑰、API、網站限制與計費設定；本功能不會替您啟用費用。');
    authFailure = error; canReuseHostMaps = false; loadPromise = null;
    if (loadAttempt) loadAttempt.finish(error);
    else { removeScript(); emitError(error); }
    pendingSearch?.finish(error);
    if (typeof previousAuthFailure === 'function') {
      try { previousAuthFailure.call(windowRef); } catch { /* Preserve our notification even if host throws. */ }
    }
  };
  function installAuthHandler() {
    if (authInstalled) return;
    previousAuthFailure = windowRef.gm_authFailure;
    windowRef.gm_authFailure = ownAuthFailure;
    authInstalled = true;
  }
  function load() {
    if (disposed) return Promise.reject(serviceError('GOOGLE_DISPOSED', 'Google 地圖模組已關閉。'));
    const apiKey = typeof googleConfig.apiKey === 'string' ? googleConfig.apiKey.trim() : '';
    if (!apiKey) return Promise.reject(serviceError('GOOGLE_NOT_CONFIGURED', '尚未設定 Google Maps 金鑰；可先使用 OpenStreetMap。'));
    if (loadPromise) return loadPromise;
    installAuthHandler();
    if (canReuseHostMaps && !authFailure && typeof windowRef.google?.maps?.Map === 'function') {
      loadPromise = Promise.resolve(windowRef.google.maps);
      return loadPromise;
    }
    if (!documentRef?.createElement || !documentRef.head?.appendChild) {
      return Promise.reject(serviceError('GOOGLE_BROWSER_REQUIRED', 'Google Maps 需要瀏覽器環境。'));
    }
    authFailure = null;
    let resolveLoad, rejectLoad;
    loadPromise = new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
    const currentPromise = loadPromise;
    let callbackName;
    do { callbackName = `__aiasGoogleMapsReady_${++callbackSequence}`; } while (callbackName in windowRef);
    let timer, finished = false;
    const ready = () => {
      const maps = windowRef.google?.maps;
      if (typeof maps?.Map !== 'function') {
        finish(serviceError('GOOGLE_LOAD_ERROR', 'Google Maps 載入未完成，請確認網路與設定後手動重試。'));
      } else finish(null, maps);
    };
    function finish(error, maps) {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (windowRef[callbackName] === ready) delete windowRef[callbackName];
      loadAttempt = null;
      if (error) {
        canReuseHostMaps = false; loadPromise = null; removeScript(); rejectLoad(error);
        if (!disposed) emitError(error);
      } else { canReuseHostMaps = true; resolveLoad(maps); }
    }
    loadAttempt = { finish };
    windowRef[callbackName] = ready;
    timer = setTimeout(() => finish(serviceError('GOOGLE_LOAD_TIMEOUT', 'Google Maps 載入逾時，請確認網路後手動重試。')), waitMs);
    try {
      const script = documentRef.createElement('script');
      scriptElement = script;
      const params = new URLSearchParams({ key: apiKey, v: 'quarterly', language: 'zh-TW', region: 'TW', loading: 'async', callback: callbackName });
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      const nonce = documentRef.querySelector?.('script[nonce]')?.nonce;
      if (nonce) script.nonce = nonce;
      script.onerror = () => finish(serviceError('GOOGLE_LOAD_ERROR', 'Google Maps 無法載入，請確認網路與網站設定後手動重試。'));
      documentRef.head.appendChild(script);
    } catch {
      finish(serviceError('GOOGLE_LOAD_ERROR', 'Google Maps 無法載入，請確認瀏覽器與網站設定後手動重試。'));
    }
    return currentPromise;
  }

  async function search(query, { signal } = {}) {
    if (signal?.aborted) throw abortError();
    const address = typeof query === 'string' ? query.trim() : '';
    if (address.length < 2 || address.length > 500) throw geocodeError('INVALID_REQUEST');
    const maps = await withSignal(load(), signal);
    if (signal?.aborted) throw abortError();
    if (disposed) throw serviceError('GOOGLE_DISPOSED', 'Google 地圖模組已關閉。');
    if (authFailure) throw authFailure;
    if (pendingSearch) {
      if (pendingSearch.query !== address) throw serviceError('GOOGLE_SEARCH_BUSY', 'Google 地址查詢仍在處理，請等候完成後再送出。');
      return withSignal(pendingSearch.promise, signal);
    }
    if (typeof maps.Geocoder !== 'function') throw serviceError('GOOGLE_GEOCODER_UNAVAILABLE', 'Google 地址服務未載入，請重新載入頁面並檢查設定。');
    let resolveSearch, rejectSearch;
    const promise = new Promise((resolve, reject) => { resolveSearch = resolve; rejectSearch = reject; });
    let finished = false;
    const timer = setTimeout(() => finish(serviceError('GOOGLE_SEARCH_TIMEOUT', 'Google 地址查詢逾時，請稍後手動重試。')), waitMs);
    function finish(error, results = []) {
      if (finished) return;
      finished = true; clearTimeout(timer); pendingSearch = null;
      if (error) rejectSearch(error);
      else {
        try {
          resolveSearch({ provider: 'google', attribution: 'Google Maps', candidates: results.map(normalizeCandidate).filter(Boolean) });
        } catch { rejectSearch(serviceError('GOOGLE_INVALID_RESPONSE', 'Google 地址回覆格式無法使用，請稍後手動重試。')); }
      }
    }
    pendingSearch = { query: address, promise, finish };
    const receive = (results, status) => {
      if (status === 'ZERO_RESULTS') finish(null, []);
      else if (status === 'OK') {
        if (!Array.isArray(results)) finish(serviceError('GOOGLE_INVALID_RESPONSE', 'Google 地址回覆格式無法使用，請稍後手動重試。'));
        else finish(null, results);
      } else finish(geocodeError(status));
    };
    try {
      const response = new maps.Geocoder().geocode({ address }, receive);
      // The callback is supported by Maps JS; handle its returned Promise too
      // so rejected statuses cannot produce an unhandled rejection.
      if (response?.then) response.then(value => receive(value?.results, 'OK'), error => receive([], typeof error === 'string' ? error : error?.code || error?.status));
    } catch (error) { finish(geocodeError(error?.code || error?.status)); }
    return withSignal(promise, signal);
  }

  return {
    load,
    geocoder: { search },
    onError(handler) {
      if (typeof handler !== 'function') throw new TypeError('onError requires a function');
      if (disposed) return () => {};
      errorListeners.add(handler);
      return () => errorListeners.delete(handler);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const error = serviceError('GOOGLE_DISPOSED', 'Google 地圖模組已關閉。');
      loadAttempt?.finish(error); pendingSearch?.finish(error);
      errorListeners.clear(); removeScript(); loadPromise = null;
      if (authInstalled && windowRef.gm_authFailure === ownAuthFailure) {
        if (previousAuthFailure === undefined) delete windowRef.gm_authFailure;
        else windowRef.gm_authFailure = previousAuthFailure;
      }
    },
  };
}
