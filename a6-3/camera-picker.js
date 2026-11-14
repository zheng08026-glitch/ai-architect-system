// A6-3 自由選擇視角 — camera picker: a 3D orbit preview plus sliders, number boxes and quick buttons.
// Original AIAS code (2026-11-14). The only third-party code is three.js (MIT, ./vendor/LICENSE-three.txt),
// loaded on demand; the sliders work even when the 3D preview cannot start.
//
// The three numbers match ComfyUI's CameraAngle node used by the A6-3 workflow:
//   horizontal 0..360 (0 front, 90 right side, 180 back), vertical -30..60, zoom 0..10 (0 wide, 10 close-up).
// The node turns them into one of 8 x 4 x 3 shot descriptions; the quick buttons light up the one that the
// current numbers fall into, so members can see when a change will (or will not) change the picture.

export const RANGES = { horizontal: [0, 360, 1], vertical: [-30, 60, 1], zoom: [0, 10, 0.1] };

export const HORIZONTAL = [
  { chip: "正面", name: "正面", value: 0, prompt: "front view" },
  { chip: "右前", name: "右前斜角", value: 45, prompt: "front-right quarter view" },
  { chip: "右側", name: "右側面", value: 90, prompt: "right side view" },
  { chip: "右後", name: "右後斜角", value: 135, prompt: "back-right quarter view" },
  { chip: "背面", name: "背面", value: 180, prompt: "back view" },
  { chip: "左後", name: "左後斜角", value: 225, prompt: "back-left quarter view" },
  { chip: "左側", name: "左側面", value: 270, prompt: "left side view" },
  { chip: "左前", name: "左前斜角", value: 315, prompt: "front-left quarter view" },
];
export const VERTICAL = [
  { chip: "仰視", name: "仰視", value: -25, below: -15, prompt: "low-angle shot" },
  { chip: "平視", name: "平視", value: 0, below: 15, prompt: "eye-level shot" },
  { chip: "俯視", name: "俯視", value: 30, below: 45, prompt: "elevated shot" },
  { chip: "鳥瞰", name: "高空鳥瞰", value: 55, below: Infinity, prompt: "high-angle shot" },
];
export const DISTANCE = [
  { chip: "遠景", name: "遠景", value: 1, below: 2, prompt: "wide shot" },
  { chip: "中景", name: "中景", value: 4, below: 6, prompt: "medium shot" },
  { chip: "近景", name: "近景", value: 8, below: Infinity, prompt: "close-up" },
];
export const DEFAULT_CAMERA = { horizontal: 45, vertical: 0, zoom: 5 };

export function horizontalIndex(h) { return Math.floor(((((h % 360) + 360) % 360) + 22.5) / 45) % 8; }
export function verticalIndex(v) { return VERTICAL.findIndex(item => v < item.below); }
export function distanceIndex(z) { return DISTANCE.findIndex(item => z < item.below); }

export function normalizeCamera(value = {}) {
  const pick = (raw, [min, max], fallback) => {
    const number = Number(raw);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  return {
    horizontal: Math.round(pick(value.horizontal, RANGES.horizontal, DEFAULT_CAMERA.horizontal)),
    vertical: Math.round(pick(value.vertical, RANGES.vertical, DEFAULT_CAMERA.vertical)),
    zoom: Math.round(pick(value.zoom, RANGES.zoom, DEFAULT_CAMERA.zoom) * 10) / 10,
  };
}

export function describeCamera(value) {
  const camera = normalizeCamera(value);
  const h = HORIZONTAL[horizontalIndex(camera.horizontal)];
  const v = VERTICAL[verticalIndex(camera.vertical)];
  const d = DISTANCE[distanceIndex(camera.zoom)];
  return { label: `${h.name}・${v.name}・${d.name}`, prompt: `${h.prompt} ${v.prompt} ${d.prompt}` };
}

const ROWS = [
  { key: "horizontal", label: "水平角度", unit: "°", items: HORIZONTAL, index: horizontalIndex,
    hint: "繞建築一圈：0° 正面、90° 右側、180° 背面、270° 左側" },
  { key: "vertical", label: "垂直角度", unit: "°", items: VERTICAL, index: verticalIndex,
    hint: "負值由下往上仰視，正值由上往下俯視（-30～60°）" },
  { key: "zoom", label: "遠近", unit: "", items: DISTANCE, index: distanceIndex,
    hint: "0 遠景（看見周邊）、10 近景（建築細部）" },
];

let pickerCount = 0;

export function mountCameraPicker(host, options = {}) {
  const id = `a63-${++pickerCount}`;
  let camera = normalizeCamera(options.value);
  let disabled = false;
  let stage3d = null;
  let pendingImage = options.image || "";

  host.innerHTML = `
    <div class="field-box a63-picker">
      <div class="a63-head">
        <span class="upload-label">選擇視角</span>
        <button type="button" class="a63-reset-view" hidden>重設檢視</button>
      </div>
      <div class="a63-stage">
        <p class="a63-stage-message">正在載入 3D 視角工具…</p>
        <ul class="a63-legend" aria-hidden="true">
          <li class="is-h">藍點　水平</li><li class="is-v">紫點　垂直</li><li class="is-z">黃色相機　遠近</li>
        </ul>
      </div>
      <div class="a63-rows">
        ${ROWS.map(row => {
          const [min, max, step] = RANGES[row.key];
          return `<div class="a63-row" data-row="${row.key}">
            <div class="a63-row-line">
              <label for="${id}-${row.key}">${row.label}</label>
              <input type="range" class="a63-range" id="${id}-${row.key}" min="${min}" max="${max}" step="${step}" data-input="${row.key}" aria-describedby="${id}-${row.key}-hint" />
              <input type="number" class="a63-number" min="${min}" max="${max}" step="${step}" data-number="${row.key}" aria-label="${row.label}數值" inputmode="decimal" />
              <span class="a63-unit">${row.unit}</span>
            </div>
            <div class="a63-chips" role="group" aria-label="${row.label}快速選擇">
              ${row.items.map((item, index) => `<button type="button" class="a63-chip" data-chip="${row.key}" data-index="${index}">${item.chip}</button>`).join("")}
            </div>
            <small class="a63-hint" id="${id}-${row.key}-hint">${row.hint}</small>
          </div>`;
        }).join("")}
      </div>
      <p class="a63-summary">AI 鏡頭：<strong data-summary-label></strong><code data-summary-prompt></code></p>
      <p class="a63-note" role="status" hidden></p>
    </div>`;

  const root = host.querySelector(".a63-picker");
  const stage = root.querySelector(".a63-stage");
  const message = root.querySelector(".a63-stage-message");
  const resetView = root.querySelector(".a63-reset-view");
  const note = root.querySelector(".a63-note");

  function syncControls(skip) {
    ROWS.forEach(row => {
      const value = camera[row.key];
      const range = root.querySelector(`[data-input="${row.key}"]`);
      const number = root.querySelector(`[data-number="${row.key}"]`);
      range.value = String(value);
      if (number !== skip) number.value = row.key === "zoom" ? value.toFixed(1) : String(value);
      const active = row.index(value);
      root.querySelectorAll(`[data-chip="${row.key}"]`).forEach(chip => {
        const on = Number(chip.dataset.index) === active;
        chip.classList.toggle("is-active", on);
        chip.setAttribute("aria-pressed", String(on));
      });
      range.disabled = number.disabled = disabled;
      root.querySelectorAll(`[data-chip="${row.key}"]`).forEach(chip => { chip.disabled = disabled; });
    });
    const shot = describeCamera(camera);
    root.querySelector("[data-summary-label]").textContent = shot.label;
    root.querySelector("[data-summary-prompt]").textContent = shot.prompt;
  }

  function setCamera(next, { emit = true, skip = null } = {}) {
    const before = JSON.stringify(camera);
    camera = normalizeCamera({ ...camera, ...next });
    syncControls(skip);
    stage3d?.update(camera);
    if (emit && JSON.stringify(camera) !== before) options.onChange?.({ ...camera });
  }

  root.addEventListener("input", event => {
    const key = event.target.dataset.input || event.target.dataset.number;
    if (!key || disabled) return;
    if (event.target.dataset.number !== undefined && (event.target.value === "" || !Number.isFinite(Number(event.target.value)))) return;
    setCamera({ [key]: Number(event.target.value) }, { skip: event.target.dataset.number !== undefined ? event.target : null });
  });
  root.addEventListener("change", event => {
    if (event.target.dataset.number !== undefined) syncControls();   // tidy a half-typed number on blur
  });
  root.addEventListener("click", event => {
    const chip = event.target.closest("[data-chip]");
    if (!chip || disabled) return;
    const row = ROWS.find(item => item.key === chip.dataset.chip);
    setCamera({ [row.key]: row.items[Number(chip.dataset.index)].value });
  });
  resetView.addEventListener("click", () => stage3d?.resetView());

  syncControls();

  import("./orbit-stage.js?v=20261114-a63")
    .then(module => module.createOrbitStage(stage, {
      camera,
      onDrag: next => setCamera(next),
      isDisabled: () => disabled,
    }))
    .then(created => {
      stage3d = created;
      message.remove();
      resetView.hidden = false;
      stage3d.setImage(pendingImage);
      stage3d.update(camera);
    })
    .catch(() => {
      message.textContent = "此裝置無法顯示 3D 預覽，請直接使用下方滑桿、數值或快速按鈕選擇視角。";
      stage.classList.add("is-unavailable");
    });

  return {
    element: root,
    getValue: () => ({ ...camera }),
    setValue: value => setCamera(value, { emit: false }),
    setImage: src => { pendingImage = src || ""; stage3d?.setImage(pendingImage); },
    setDisabled: value => { disabled = Boolean(value); root.classList.toggle("is-disabled", disabled); syncControls(); },
    setNote: text => { note.textContent = text || ""; note.hidden = !text; },
    describe: () => describeCamera(camera),
  };
}
