import { measureBounds } from './domain.js';

// 「含高程輸出」 samples the 內政部 20 m DTM held by the modelling host, which only covers 臺北市: 64 TWD97 / TM2 121 tiles
// from taipei-dem-official.zip (sha256 f30d5586f33a…). The host rejects a range when any point of its sample grid falls
// outside them (e.g. 板橋, 台中, 金門), so the same check runs here before a member submits.
const TILES = [[303780,2760120,306380,2762960],[306300,2760140,308900,2762980],[308820,2760140,311420,2762980],[311360,2760160,313960,2763000],[301240,2762880,303840,2765720],[303780,2762900,306360,2765740],[306300,2762900,308880,2765740],[308820,2762920,311420,2765760],[311340,2762920,313940,2765760],[298720,2765640,301300,2768480],[301240,2765660,303840,2768500],[303760,2765660,306360,2768500],[306280,2765680,308880,2768520],[308800,2765680,311400,2768520],[311320,2765700,313920,2768540],[313860,2765700,316440,2768540],[316380,2765720,318980,2768560],[298700,2768420,301300,2771240],[301220,2768420,303820,2771260],[303740,2768440,306340,2771260],[306280,2768440,308860,2771280],[308800,2768460,311380,2771300],[311320,2768460,313920,2771300],[313840,2768480,316440,2771320],[316360,2768480,318960,2771320],[298700,2771180,301280,2774020],[301220,2771180,303800,2774020],[303740,2771200,306340,2774040],[306260,2771200,308860,2774040],[308780,2771220,311380,2774060],[311300,2771240,313900,2774080],[298680,2773940,301280,2776780],[301200,2773960,303800,2776800],[303720,2773960,306320,2776800],[306240,2773980,308840,2776820],[308760,2773980,311360,2776820],[311300,2774000,313880,2776840],[293640,2776700,296220,2779540],[296160,2776720,298740,2779540],[298680,2776720,301260,2779560],[301200,2776720,303780,2779560],[303720,2776740,306300,2779580],[306240,2776740,308820,2779580],[308760,2776760,311360,2779600],[311280,2776760,313880,2779620],[296140,2779480,298740,2782320],[298660,2779480,301260,2782320],[301180,2779500,303780,2782340],[303700,2779500,306300,2782340],[306220,2779520,308820,2782360],[308740,2779520,311340,2782360],[296140,2782240,298720,2785080],[298660,2782260,301240,2785100],[301180,2782260,303760,2785100],[303700,2782280,306280,2785120],[306220,2782280,308800,2785120],[308740,2782300,311320,2785140],[298640,2785020,301240,2787860],[301160,2785040,303760,2787880],[303680,2785040,306280,2787880],[306200,2785060,308800,2787900],[308720,2785060,311320,2787900],[303680,2787820,306260,2790660],[306200,2787820,308780,2790660]];
export const RELIEF_COVERAGE_MESSAGE = '「含高程輸出」目前只涵蓋臺北市；此範圍請改選「1. 全平面輸出」後再送出。';

// Same GRS80 / TM2 zone 121 series as the host's terrain.mjs projectTwd97 (WGS84 treated as TWD97 geographic).
function projectTwd97(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 119 || lng > 123 || lat < 20 || lat > 28) return null;
  const a = 6378137, f = 1 / 298.257222101, e = Math.sqrt(f * (2 - f)), radians = Math.PI / 180;
  const n = f / (2 - f), phi = lat * radians, lambda = (lng - 121) * radians;
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
const covered = (lng, lat) => { const p = projectTwd97(lng, lat); return !!p && TILES.some(([w, s, e, n]) => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n); };

/** True when every point the host samples for 含高程輸出 (centre + grid at ≤ 20 m spacing) lies inside the DTM tiles. */
export function reliefCovered(bounds) {
  let size;
  try { size = measureBounds(bounds); } catch { return false; }
  const { west, south, east, north } = bounds;
  if (!covered((west + east) / 2, (south + north) / 2)) return false;
  const segments = Math.max(2, Math.ceil(Math.max(size.widthM, size.depthM) / 20));
  for (let row = 0; row <= segments; row++) for (let column = 0; column <= segments; column++) {
    if (!covered(column === segments ? east : west + (east - west) * column / segments, row === segments ? north : south + (north - south) * row / segments)) return false;
  }
  return true;
}
