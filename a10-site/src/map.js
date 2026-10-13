import { normalizeBounds } from './domain.js';

/** Display configuration only. Never feeds source rights, geometry or export requests. */
export function leafletTileOptions(config = {}) {
  const maxZoom = config.maxZoom ?? 19;
  if (!Number.isInteger(maxZoom) || maxZoom < 3 || maxZoom > 19) throw new Error('底圖縮放層級設定不正確。');
  if (config.id === 'nlsc-aerial' && (config.displayOnly !== true || typeof config.url !== 'string' || !config.url.trim())) {
    throw new Error('國土測繪中心航照顯示設定不完整。');
  }
  return { attribution: config.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom, noWrap: true, keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false, detectRetina: false };
}

/** Leaflet implementation of the replaceable map port. Coordinates inside this port are lat,lng. */
export function createLeafletMap(container, config = {}, callbacks = {}) {
  const L = globalThis.L;
  if (!L) throw new Error('本機地圖程式未能載入，請重新開啟預覽。');
  // Immediate zoom avoids a pending touch/zoom transition overwriting a later
  // fitBounds result, especially after the viewport changes to a phone layout.
  const map = L.map(container, { zoomControl: false, zoomAnimation: false, attributionControl: true, worldCopyJump: false, maxBounds: [[-85, -180], [85, 180]], minZoom: 3, maxZoom: 19 }).setView([25.033, 121.543], 15);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  let tiles, tileFailed = false, loadingTimer, generation = 0;
  const startTileTimer = () => { clearTimeout(loadingTimer); loadingTimer = setTimeout(() => { tileFailed = true; callbacks.onTileError?.(); }, 15000); };
  const setBasemap = nextConfig => {
    const options = leafletTileOptions(nextConfig);
    const next = L.tileLayer(nextConfig.url || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options);
    const current = ++generation;
    // Leaflet's own remove listener detaches map zoom/move handlers; let that
    // lifecycle run before clearing listeners owned by this adapter.
    clearTimeout(loadingTimer); tiles?.remove(); tiles?.off(); tiles = next; tileFailed = false;
    // Remove the former layer before zoom capping so it cannot fetch new tiles.
    map.setMaxZoom(options.maxZoom);
    tiles.on('loading', () => { if (current !== generation) return; tileFailed = false; callbacks.onLoading?.(); startTileTimer(); });
    tiles.on('tileerror', () => { if (current !== generation) return; tileFailed = true; callbacks.onTileError?.(); });
    tiles.on('load', () => { if (current !== generation) return; clearTimeout(loadingTimer); callbacks.onLoaded?.(!tileFailed); });
    callbacks.onLoading?.(); startTileTimer(); tiles.addTo(map);
  };
  setBasemap(config);
  let rectangle, draft, first, marker, drawing = false;
  const rectanglePoints = bounds => [[bounds.south, bounds.west], [bounds.north, bounds.east]];
  const draftStyle = { color: '#c18e3a', weight: 2, dashArray: '5 5', fillOpacity: 0.08, interactive: false };
  const finishDrawing = () => {
    drawing = false; first = null;
    if (draft) { draft.remove(); draft = null; }
    map.dragging.enable(); map.doubleClickZoom.enable(); container.style.cursor = '';
    callbacks.onDrawState?.(false, false);
  };
  map.on('click', event => {
    if (!drawing) return;
    if (!first) { first = { lat: event.latlng.lat, lng: event.latlng.lng }; callbacks.onDrawState?.(true, true); return; }
    const second = { lat: event.latlng.lat, lng: event.latlng.lng };
    if (first.lat === second.lat || first.lng === second.lng) { callbacks.onDrawError?.('請選取不同的對角，範圍需有寬度和深度。'); return; }
    const bounds = normalizeBounds(first, second);
    finishDrawing(); callbacks.onSelect?.(bounds);
  });
  map.on('mousemove', event => {
    if (!drawing || !first) return;
    const points = [first, event.latlng];
    if (!draft) draft = L.rectangle(points, draftStyle).addTo(map); else draft.setBounds(points);
  });
  const onKeydown = event => { if (event.key === 'Escape') finishDrawing(); };
  container.addEventListener('keydown', onKeydown);
  const observer = new ResizeObserver(() => map.invalidateSize({ animate: false })); observer.observe(container);
  return {
    setBasemap,
    setDrawing(active) {
      finishDrawing();
      if (!active) return;
      drawing = true; map.dragging.disable(); map.doubleClickZoom.disable(); container.style.cursor = 'crosshair';
      callbacks.onDrawState?.(true, false);
    },
    setBounds(bounds, { confirmed = false, fit = false } = {}) {
      if (!bounds) { rectangle?.remove(); rectangle = null; return; }
      const style = { color: '#216d60', weight: 2, fillColor: '#32765b', fillOpacity: confirmed ? 0.2 : 0.11, dashArray: confirmed ? undefined : '7 5', interactive: false };
      if (rectangle) rectangle.setBounds(rectanglePoints(bounds)).setStyle(style); else rectangle = L.rectangle(rectanglePoints(bounds), style).addTo(map);
      if (fit) this.fit(bounds);
    },
    fit(bounds) { map.stop(); map.fitBounds(rectanglePoints(bounds), { padding: [65, 65], maxZoom: 18, animate: false }); },
    setMarker(candidate) {
      marker?.remove(); marker = null;
      if (!candidate) return;
      marker = L.marker([candidate.lat, candidate.lng], { draggable: true, icon: L.divIcon({ className: '', html: '<div class="aias-pin"></div>', iconSize: [25, 25], iconAnchor: [12, 25] }), title: '候選位置：可拖曳調整，需確認', alt: '候選地址標記' }).addTo(map);
      marker.on('dragend', () => callbacks.onMarkerMove?.({ lat: marker.getLatLng().lat, lng: marker.getLatLng().lng }));
    },
    retry() { tileFailed = false; callbacks.onLoading?.(); startTileTimer(); tiles.redraw(); },
    destroy() { ++generation; clearTimeout(loadingTimer); observer.disconnect(); container.removeEventListener('keydown', onKeydown); map.remove(); tiles?.off(); },
  };
}
