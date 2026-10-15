import { measureBounds } from './domain.js';

// 「含高程輸出」 samples 內政部 2025 年版 20 m DTM on the modelling host: three rasters, each in its own TM2 zone
// (臺灣本島 121; 澎湖、金門 119 — never mixed, their numbers overlap). A point is covered when it lies within a raster's
// extent plus a 5 km sea margin (sea is filled with 0 m there); 連江縣（馬祖） and open sea are not. Same rule and
// sample grid as the host's terrain2025.mjs, so the member is told before submitting. Fully-sea ranges (or 綠島、龜山島,
// which the rasters do not cover) are only detectable from the raster data, so the host rejects those with a reason.
const SOURCES = [
  { id: 'kinmen', zone: 119, west: 169600, east: 197580, south: 2697600, north: 2714380 },
  { id: 'penghu', zone: 119, west: 282140, east: 324220, south: 2565000, north: 2634100 },
  { id: 'taiwan', zone: 121, west: 150980, east: 351660, south: 2422140, north: 2799160 },
];
const SEA_MARGIN_M = 5000;
export const RELIEF_COVERAGE_MESSAGE = '「含高程輸出」不涵蓋此範圍：連江縣（馬祖）與外海沒有官方地形資料；請改選「1. 全平面輸出」後再送出。';

// Same GRS80 / TM2 series as the host (WGS84 treated as TWD97 geographic), with the zone's central meridian.
function projectTm2(lng, lat, zone) {
  const a = 6378137, f = 1 / 298.257222101, e = Math.sqrt(f * (2 - f)), radians = Math.PI / 180;
  const n = f / (2 - f), phi = lat * radians, lambda = (lng - zone) * radians;
  const conformal = Math.atan(Math.sinh(Math.asinh(Math.tan(phi)) - e * Math.atanh(e * Math.sin(phi))));
  const xiPrime = Math.atan2(Math.tan(conformal), Math.cos(lambda));
  const etaPrime = Math.asinh(Math.sin(lambda) / Math.hypot(Math.tan(conformal), Math.cos(lambda)));
  const alpha = [
    n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180 - 127 * n ** 5 / 288 + 7891 * n ** 6 / 37800,
    13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440 + 281 * n ** 5 / 630 - 1983433 * n ** 6 / 1935360,
    61 * n ** 3 / 240 - 103 * n ** 4 / 140 + 15061 * n ** 5 / 26880 + 167603 * n ** 6 / 181440,
    49561 * n ** 4 / 161280 - 179 * n ** 5 / 168 + 6601661 * n ** 6 / 7257600,
    34729 * n ** 5 / 80640 - 3418889 * n ** 6 / 1995840,
    212378941 * n ** 6 / 319334400
  ];
  let xi = xiPrime, eta = etaPrime;
  alpha.forEach((coefficient, i) => {
    const j = 2 * (i + 1);
    xi += coefficient * Math.sin(j * xiPrime) * Math.cosh(j * etaPrime);
    eta += coefficient * Math.cos(j * xiPrime) * Math.sinh(j * etaPrime);
  });
  const A = a / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64 + n ** 6 / 256);
  return [250000 + 0.9999 * A * eta, 0.9999 * A * xi];
}
const locate = (lng, lat) => {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < 20 || lat > 28 || lng < 117 || lng > 123) return null;
  for (const s of SOURCES) {
    const [x, y] = projectTm2(lng, lat, s.zone);
    if (x >= s.west - SEA_MARGIN_M && x <= s.east + SEA_MARGIN_M && y >= s.south - SEA_MARGIN_M && y <= s.north + SEA_MARGIN_M) return s.id;
  }
  return null;
};

/** True when every point the host samples for 含高程輸出 (centre + grid at ≤ 20 m spacing) falls in one DTM source. */
export function reliefCovered(bounds) {
  let size;
  try { size = measureBounds(bounds); } catch { return false; }
  const { west, south, east, north } = bounds, source = locate((west + east) / 2, (south + north) / 2);
  if (!source) return false;
  const segments = Math.max(2, Math.ceil(Math.max(size.widthM, size.depthM) / 20));
  for (let row = 0; row <= segments; row++) for (let column = 0; column <= segments; column++) {
    if (locate(column === segments ? east : west + (east - west) * column / segments, row === segments ? north : south + (north - south) * row / segments) !== source) return false;
  }
  return true;
}
