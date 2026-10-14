/** Pure geographic/request helpers. No network, DOM, accounts, or AIAS dependency. */
export const EARTH_RADIUS_M = 6371008.8;
export const LIMITS = Object.freeze({
  warningAreaM2: 1_000_000,
  warningSideM: 2_000,
  maximumAreaM2: 25_000_000,
  maximumSideM: 10_000,
  maximumLatitude: 85,
});

const RAD = Math.PI / 180;
// Floating-point round-off must not reject a rectangle exactly at a side limit.
const METRE_EPSILON = 1e-6;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function requirePoint(point) {
  if (!point || !isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
    throw new TypeError('座標必須包含有限數值 lat 與 lng。');
  }
}

/** Order two opposite rectangle corners, regardless of drawing direction. */
export function normalizeBounds(a, b) {
  requirePoint(a);
  requirePoint(b);
  return {
    west: Math.min(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    north: Math.max(a.lat, b.lat),
  };
}

function structureErrors(bounds) {
  if (!bounds || !['west', 'south', 'east', 'north'].every((key) => isFiniteNumber(bounds[key]))) {
    return ['範圍必須包含有限數值 west、south、east、north。'];
  }
  const errors = [];
  if (bounds.west < -180 || bounds.west > 180 || bounds.east < -180 || bounds.east > 180) {
    errors.push('經度必須介於 -180 與 180 度之間。');
  }
  if (Math.abs(bounds.south) > LIMITS.maximumLatitude || Math.abs(bounds.north) > LIMITS.maximumLatitude) {
    errors.push('本功能支援的緯度範圍為 -85 至 85 度。');
  }
  if (bounds.south >= bounds.north) errors.push('南北範圍必須大於零，且 south 小於 north。');
  if (bounds.west >= bounds.east) errors.push('東西範圍必須大於零；不支援跨越國際換日線。');
  if (bounds.east - bounds.west > 180) errors.push('不支援跨越國際換日線或橫跨超過 180 度的範圍。');
  return errors;
}

/**
 * Dimensions use a mean-radius spherical approximation, NOT cadastral survey.
 * Width is the east-west arc at the midpoint latitude; depth is meridian arc.
 * Area is the spherical latitude/longitude rectangle area (not width * depth).
 */
export function measureBounds(bounds) {
  const errors = structureErrors(bounds);
  if (errors.length) throw new RangeError(errors.join(' '));
  const center = { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 };
  const deltaLng = (bounds.east - bounds.west) * RAD;
  const deltaLat = (bounds.north - bounds.south) * RAD;
  return {
    widthM: EARTH_RADIUS_M * deltaLng * Math.cos(center.lat * RAD),
    depthM: EARTH_RADIUS_M * deltaLat,
    areaM2: EARTH_RADIUS_M ** 2 * deltaLng * (Math.sin(bounds.north * RAD) - Math.sin(bounds.south * RAD)),
    center,
  };
}

export function validateBounds(bounds) {
  const errors = structureErrors(bounds);
  const warnings = [];
  if (!errors.length) {
    const { widthM, depthM, areaM2 } = measureBounds(bounds);
    if (widthM > LIMITS.maximumSideM + METRE_EPSILON || depthM > LIMITS.maximumSideM + METRE_EPSILON) {
      errors.push('單邊超過 10,000 m，請縮小範圍。');
    }
    if (areaM2 > LIMITS.maximumAreaM2) errors.push('面積超過 25 km²，請縮小範圍。');
    if (widthM > LIMITS.warningSideM + METRE_EPSILON || depthM > LIMITS.warningSideM + METRE_EPSILON) {
      warnings.push('單邊超過 2,000 m，未來資料處理與 SKP 模型可能較大。');
    }
    if (areaM2 > LIMITS.warningAreaM2) warnings.push('面積超過 1 km²，建議縮小至設計基地周邊所需範圍。');
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Create a rectangle centered on a coordinate; dimensions are metres. */
export function boundsFromCenter(center, widthM, depthM) {
  requirePoint(center);
  if (Math.abs(center.lat) > LIMITS.maximumLatitude || Math.abs(center.lng) > 180) {
    throw new RangeError('中心點超出支援的經緯度範圍。');
  }
  if (![widthM, depthM].every((value) => isFiniteNumber(value) && value > 0)) {
    throw new RangeError('寬度與深度必須為大於零的公尺數值。');
  }
  const halfLat = (depthM / (2 * EARTH_RADIUS_M)) / RAD;
  const halfLng = (widthM / (2 * EARTH_RADIUS_M * Math.cos(center.lat * RAD))) / RAD;
  const bounds = {
    west: center.lng - halfLng,
    south: center.lat - halfLat,
    east: center.lng + halfLng,
    north: center.lat + halfLat,
  };
  const errors = structureErrors(bounds);
  if (errors.length) throw new RangeError(errors.join(' '));
  return bounds;
}

/**
 * Export a reviewed request only. This does not create a job, validate data
 * coverage, or imply that an SKP file, aerial image, or height data exists.
 */
export function buildRequest({ bounds, selection, confirmedAt, missingHeightPolicy = 'omit-and-report', terrainMode = 'flat', siteOptions = {} }) {
  siteOptions = {buildingMode:'source-only',floorHeightM:3,fallbackHeightM:9,aerialMode:'none',contextMode:'none',blockMaterial:'aerial',...siteOptions};
  if (!['source-only','levels','massing'].includes(siteOptions.buildingMode) || !['none','private-photo2'].includes(siteOptions.aerialMode) || !['none','schematic'].includes(siteOptions.contextMode) || !Number.isFinite(siteOptions.floorHeightM) || siteOptions.floorHeightM<2 || siteOptions.floorHeightM>6) throw new RangeError('基地輸出選項無效；估算層高需為 2～6 公尺。');
  if (!Number.isFinite(siteOptions.fallbackHeightM)||siteOptions.fallbackHeightM<1||siteOptions.fallbackHeightM>100) throw new RangeError('示意建築高度需為 1～100 公尺。');
  if (!['aerial','gray'].includes(siteOptions.blockMaterial)) throw new RangeError('街廓輸出選項無效。');
  if (!['flat','relief'].includes(terrainMode)) throw new RangeError('地形輸出模式無效。');
  const validation = validateBounds(bounds);
  if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  if (!selection || !['map', 'address'].includes(selection.method)) {
    throw new TypeError('選取模式必須為 map 或 address。');
  }
  // Provenance is independent of the active UI mode. Do not erase it on resize
  // or mode changes; only a newly authored ROI may replace the old selection.
  if (selection.provenance === 'google-geocoding' || selection.candidate?.provider === 'google') {
    const error = new Error('Google 定位候選與其自動建立的範圍不能匯出至通用 JSON。請重新手繪自訂範圍並再次確認；僅切換模式或調整尺寸不會解除來源限制。');
    error.code = 'GOOGLE_PROVENANCE_NOT_EXPORTABLE';
    throw error;
  }
  if (selection.provenance != null && !['user-authored', 'independent-geocoder'].includes(selection.provenance)) {
    throw new TypeError('選取來源必須為 user-authored 或 independent-geocoder；舊請求可省略。');
  }
  if (selection.method === 'address' && selection.markerConfirmed !== true) {
    throw new Error('地址候選的位置仍需使用者確認標記。');
  }
  if (selection.method === 'address' && (!selection.candidate || typeof selection.candidate !== 'object' || Array.isArray(selection.candidate))) {
    throw new TypeError('地址模式必須包含已選擇的地址候選。');
  }
  if (typeof confirmedAt !== 'string' || !confirmedAt.trim() || !Number.isFinite(Date.parse(confirmedAt))) {
    throw new TypeError('必須先確認範圍，並提供有效的 confirmedAt 日期字串。');
  }
  if (missingHeightPolicy !== 'omit-and-report') {
    throw new RangeError('本功能僅支援缺少樓高時略過並列入報告，不可臆造樓高。');
  }
  const metrics = measureBounds(bounds);
  const { west, south, east, north } = bounds;
  const candidate = selection.candidate == null ? null : JSON.parse(JSON.stringify(selection.candidate));
  if (candidate) candidate.precision = 'unverified';
  return {
    schemaVersion: 'aias.site-model.request.v1',
    requestType: 'site-model-generation',
    submissionState: 'local-request-only',
    coordinateReferenceSystem: 'EPSG:4326',
    coordinateOrder: 'longitude,latitude',
    bounds: { west, south, east, north },
    spatialReference: {
      id: 'site-extent',
      bounds: { west, south, east, north },
      coordinateReferenceSystem: 'EPSG:4326',
      coordinateOrder: 'longitude,latitude',
      orientation: {
        northReference: 'true-north',
        image: 'north-up',
        modelAxes: { x: 'east', y: 'true-north', z: 'up' },
      },
      verification: 'requested-not-verified',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
    },
    measurements: {
      ...metrics,
      units: { length: 'm', area: 'm2' },
      method: 'mean-radius-sphere',
      earthRadiusM: EARTH_RADIUS_M,
      note: '球面近似；寬為中心緯度弧長，深為子午線弧長，面積為球面矩形面積。非地籍或測量成果。',
    },
    selection: {
      method: selection.method,
      provenance: selection.provenance ?? null,
      query: typeof selection.query === 'string' ? selection.query : '',
      candidate,
      markerConfirmed: selection.markerConfirmed === true,
      precision: 'unverified',
    },
    confirmation: {
      confirmedAt: new Date(confirmedAt).toISOString(),
      scope: 'user-reviewed-location-and-bounds',
      surveyAccuracyVerified: false,
    },
    requestedOutputs: {
      format: 'skp',
      groundAerialTexture: true,
      terrainMode,
      siteOptions,
      terrainRelief: terrainMode === 'relief',
      surroundingBuildings: { appearance: 'white-massing', heightSource: siteOptions.buildingMode!=='source-only' ? 'source-height-or-explicitly-labelled-level-estimate' : 'licensed-observed-data-only' },
      facadePhotoTextures: false,
      aerialImage: { enabled: siteOptions.aerialMode!=='private-photo2', formats: ['png', 'jpg'], scope: 'same-bounds-as-model', orientation: 'north-up' },
    },
    missingHeightPolicy,
    coverage: { status: 'unverified', aerial: 'not-connected', terrain: 'not-connected', buildings: 'not-connected', buildingHeights: 'not-connected' },
    generation: {
      status: 'not-connected', jobId: null, downloadUrl: null,
      artifacts: {
        model: {
          status: 'not-connected', format: 'skp', spatialReferenceId: 'site-extent', downloadUrl: null,
          metadata: { source: null, license: null, coordinateReferenceSystem: null, origin: null, verticalDatum: null },
        },
        aerial: {
          status: 'not-connected', formats: ['png', 'jpg'], format: null, spatialReferenceId: 'site-extent', downloadUrl: null,
          metadata: {
            source: null, attribution: null, license: null,
            captureDate: { kind: 'unknown', date: null, startDate: null, endDate: null, mosaicSources: null },
            metersPerPixel: null, scaleBarLengthM: null, widthPx: null, heightPx: null,
          },
        },
      },
    },
    sourceRequirements: {
      checkCoverageAndLicenseBeforeJob: true,
      requireExportAndDerivativeRights: true,
      requireStandaloneAerialExportRights: siteOptions.aerialMode!=='private-photo2',
      requirePerArtifactAuthorization: true,
      requireAttributionAndSourceDate: true,
      excludeGoogle3DExtraction: true,
      excludeGoogleMapsContentAsOutputSource: true,
      independentLicensedSourcesRequired: true,
    },
    warnings: validation.warnings,
  };
}
