import { normalizeBounds } from './domain.js';

const instances = new WeakMap();
const DEFAULT_CENTER = { lat: 25.033, lng: 121.543 };

/**
 * Official Maps JS API map port; the host loads the API before calling this.
 * No DrawingManager, script injection, imagery access, capture or download.
 * Marker is deprecated but still supported without an additional map ID:
 * https://developers.google.com/maps/documentation/javascript/reference/marker
 * https://developers.google.com/maps/documentation/javascript/reference/map
 */
export function createGoogleMap(container, config = {}, callbacks = {}) {
  const maps = config.maps ?? globalThis.google?.maps;
  if (!maps?.Map || !maps.Rectangle || !maps.Marker) throw new Error('Google 地圖程式尚未就緒，請確認地圖與標記程式已載入。');
  if (instances.has(container)) throw new Error('地圖容器已初始化，請先釋放舊地圖。');
  let map, rectangle, draft, marker, markerListener, timer;
  let bounds = null, confirmed = false, candidate = null, first = null;
  let drawing = false, destroyed = false, loading = false, epoch = 0;
  const listeners = [];
  const originalCursor = container.style.cursor;
  const emit = (name, ...args) => { if (!destroyed) callbacks[name]?.(...args); };
  const pointOf = value => {
    if (!value) return null;
    const lat = typeof value.lat === 'function' ? value.lat() : value.lat;
    const lng = typeof value.lng === 'function' ? value.lng() : value.lng;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };
  const beginLoading = () => {
    if (destroyed || loading) return;
    loading = true; emit('onLoading');
    clearTimeout(timer);
    // Maps exposes tilesloaded, not a public per-tile failure event.
    timer = setTimeout(() => {
      if (destroyed) return;
      loading = false; emit('onTileError'); emit('onLoaded', false);
    }, 15_000);
  };
  const removeDraft = () => { draft?.setMap(null); draft = null; first = null; };
  const stopDrawing = () => {
    const changed = drawing || first !== null;
    drawing = false; removeDraft(); container.style.cursor = originalCursor;
    map?.setOptions({ gestureHandling: 'greedy', draggableCursor: null });
    marker?.setDraggable(true);
    if (changed) emit('onDrawState', false, false);
  };
  const renderBounds = () => {
    if (!bounds) { rectangle?.setMap(null); rectangle = null; return; }
    const options = { bounds: { ...bounds }, map, clickable: false, editable: false, draggable: false, strokeColor: '#216d60', strokeOpacity: confirmed ? 1 : 0.75, strokeWeight: 2, fillColor: '#32765b', fillOpacity: confirmed ? 0.2 : 0.11 };
    if (rectangle) rectangle.setOptions(options); else rectangle = new maps.Rectangle(options);
  };
  const renderMarker = () => {
    markerListener?.remove(); markerListener = null;
    marker?.setMap(null); marker = null;
    if (!candidate) return;
    const currentEpoch = epoch;
    const currentMarker = new maps.Marker({ map, position: { lat: candidate.lat, lng: candidate.lng }, draggable: !drawing, title: '候選位置：可拖曳調整，需確認', optimized: false });
    marker = currentMarker;
    markerListener = currentMarker.addListener('dragend', () => {
      if (destroyed || currentEpoch !== epoch || currentMarker !== marker || drawing) return;
      const point = pointOf(currentMarker.getPosition());
      if (!point) return;
      candidate = { ...candidate, ...point };
      emit('onMarkerMove', point);
    });
  };
  function initialize(center = DEFAULT_CENTER, zoom = 13) {
    const currentEpoch = ++epoch;
    map = new maps.Map(container, {
      center, zoom, minZoom: 3, maxZoom: 19,
      mapTypeId: 'roadmap', mapTypeControl: false, streetViewControl: false,
      fullscreenControl: false, rotateControl: false, zoomControl: true, scaleControl: true,
      clickableIcons: false, gestureHandling: 'greedy', heading: 0, tilt: 0,
      headingInteractionEnabled: false, tiltInteractionEnabled: false,
      restriction: { latLngBounds: { west: -180, south: -85, east: 180, north: 85 }, strictBounds: true },
    });
    const listen = (name, handler) => listeners.push(map.addListener(name, (...args) => {
      if (!destroyed && currentEpoch === epoch) handler(...args);
    }));
    listen('bounds_changed', beginLoading);
    listen('tilesloaded', () => { clearTimeout(timer); loading = false; emit('onLoaded', true); });
    listen('click', event => {
      if (!drawing) return;
      const point = pointOf(event?.latLng);
      if (!point) return;
      if (!first) { first = point; emit('onDrawState', true, true); return; }
      if (first.lat === point.lat || first.lng === point.lng) {
        emit('onDrawError', '請選不同的對角，範圍需有寬度和深度。'); return;
      }
      const selected = normalizeBounds(first, point);
      stopDrawing(); emit('onSelect', selected);
    });
    listen('mousemove', event => {
      if (!drawing || !first) return;
      const point = pointOf(event?.latLng);
      if (!point) return;
      const draftBounds = normalizeBounds(first, point);
      if (draft) draft.setBounds(draftBounds);
      else draft = new maps.Rectangle({ map, bounds: draftBounds, clickable: false, editable: false, draggable: false, strokeColor: '#c18e3a', strokeWeight: 2, fillOpacity: 0.08 });
    });
    renderBounds(); renderMarker(); beginLoading();
  }
  function disposeMap() {
    clearTimeout(timer); loading = false; epoch++;
    listeners.splice(0).forEach(listener => listener.remove());
    markerListener?.remove(); markerListener = null;
    marker?.setMap(null); marker = null;
    rectangle?.setMap(null); rectangle = null;
    removeDraft(); map?.unbindAll(); map = null;
    container.replaceChildren();
  }
  const onKeydown = event => { if (!destroyed && event.key === 'Escape') stopDrawing(); };
  const port = {
    setDrawing(active) {
      if (destroyed) return;
      stopDrawing();
      if (!active) return;
      drawing = true; map.setOptions({ gestureHandling: 'none', draggableCursor: 'crosshair' });
      marker?.setDraggable(false); container.style.cursor = 'crosshair'; emit('onDrawState', true, false);
    },
    setBounds(nextBounds, { confirmed: nextConfirmed = false, fit = false } = {}) {
      if (destroyed) return;
      bounds = nextBounds ? { ...nextBounds } : null; confirmed = nextConfirmed; renderBounds();
      if (fit && bounds) port.fit(bounds);
    },
    fit(nextBounds) { if (!destroyed && nextBounds) map.fitBounds({ ...nextBounds }, 65); },
    setMarker(nextCandidate) {
      if (destroyed) return;
      if (nextCandidate && !pointOf(nextCandidate)) throw new TypeError('標記座標必須是有限數值。');
      candidate = nextCandidate ? { ...nextCandidate } : null; renderMarker();
    },
    retry() {
      if (destroyed) return;
      const center = pointOf(map.getCenter()) || DEFAULT_CENTER;
      const zoom = map.getZoom() ?? 13;
      stopDrawing(); disposeMap(); initialize(center, zoom);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; drawing = false; disposeMap();
      container.removeEventListener('keydown', onKeydown); container.style.cursor = originalCursor;
      instances.delete(container);
    },
  };
  try {
    initialize(); container.addEventListener('keydown', onKeydown); instances.set(container, port);
  } catch (error) { destroyed = true; disposeMap(); throw error; }
  return port;
}
