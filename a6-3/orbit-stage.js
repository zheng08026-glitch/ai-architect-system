// A6-3 3D orbit preview (original AIAS code, 2026-11-14) built on three.js r170 (MIT, ./vendor/LICENSE-three.txt).
// A subject cube (the uploaded picture on its front face) sits inside a wire sphere. Drag the cyan point along
// the ring for the horizontal angle, the magenta point along the arc for the vertical angle, the yellow camera
// along its line for the distance; drag empty space to turn the preview itself. Renders only when something changes.
import * as THREE from "./vendor/three.module.min.js?v=r170";

const R = 2.2;            // orbit sphere radius
const CUBE = 1.4;         // subject cube edge
const FAR = 2.05;         // camera distance at zoom 0 (wide shot)
const NEAR = 1.32;        // camera distance at zoom 10 (close-up), just outside the cube corner
const VIEW_DISTANCE = 8.6;
const DEFAULT_VIEW = { az: -30, el: 24 };   // front-left, so the default camera (front-right) is seen from the side
const DEG = Math.PI / 180;
const V_MIN = -30;
const RING_RADIUS = R * Math.cos(V_MIN * DEG);
const RING_Y = R * Math.sin(V_MIN * DEG);

const PALETTES = {
  dark: { wire: 0xc9ccd8, wireOpacity: 0.2, face: "#2b3242", faceText: "#d5dbea", edge: 0x9aa3ba,
          h: 0x2fd3f0, v: 0xe25cf5, z: 0xffcf1f, track: 0.22 },
  light: { wire: 0x4c5366, wireOpacity: 0.22, face: "#dfe3ec", faceText: "#3a4157", edge: 0x7a8296,
           h: 0x0ea5c6, v: 0xc026d3, z: 0xe0a800, track: 0.28 },
};
const FACE_LABELS = { px: "右側", nx: "左側", py: "頂部", ny: "底部", nz: "背面" };

function isLightTheme() { return ["silver", "white"].includes(document.body?.dataset.theme); }

function direction(h, v, out = new THREE.Vector3()) {
  return out.set(Math.cos(v * DEG) * Math.sin(h * DEG), Math.sin(v * DEG), Math.cos(v * DEG) * Math.cos(h * DEG));
}

class ElevationArc extends THREE.Curve {
  constructor(h, from, to) { super(); this.h = h; this.from = from; this.to = to; }
  getPoint(t, target = new THREE.Vector3()) {
    return direction(this.h, this.from + (this.to - this.from) * t, target).multiplyScalar(R);
  }
}

function canvasTexture(draw, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function labelTexture(text, palette) {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = palette.face; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = palette.faceText; ctx.font = `600 ${size * 0.17}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, size / 2, size / 2);
  });
}

function glowTexture() {
  return canvasTexture((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)"); gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  }, 128);
}

export function createOrbitStage(container, { camera, onDrag, isDisabled }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });   // throws without WebGL
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "a63-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const view = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  const viewAngles = { ...DEFAULT_VIEW };
  let palette = PALETTES[isLightTheme() ? "light" : "dark"];
  let state = { ...camera };
  let imageSource = "";

  // wire sphere
  const wireMaterial = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R, 2)), wireMaterial));

  // subject cube: BoxGeometry face order +x, -x, +y, -y, +z (front), -z
  const faceKeys = ["px", "nx", "py", "ny", "pz", "nz"];
  const faceMaterials = faceKeys.map(() => new THREE.MeshBasicMaterial());
  const cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), faceMaterials);
  const edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), edgeMaterial));
  scene.add(cube);

  // Horizontal ring on the lowest allowed latitude (-30°), like a ground circle, so the horizontal point and the
  // vertical point never sit on top of each other; a thicker invisible copy makes the whole ring grabbable.
  const ringMaterial = new THREE.MeshBasicMaterial();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.03, 10, 160), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = RING_Y;
  const ringHit = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.16, 6, 96),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  ringHit.rotation.x = Math.PI / 2;
  ringHit.position.y = RING_Y;
  scene.add(ring, ringHit);

  // vertical arc: faint full range + bright part from the ring up to the vertical point
  const trackMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const arcMaterial = new THREE.MeshBasicMaterial();
  const track = new THREE.Mesh(new THREE.BufferGeometry(), trackMaterial);
  const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMaterial);
  scene.add(track, arc);

  const glow = glowTexture();
  function handle(radius) {
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    halo.scale.setScalar(radius * 5);
    mesh.add(halo);
    scene.add(mesh);
    return { mesh, material, halo };
  }
  const hHandle = handle(0.11);
  const vHandle = handle(0.11);

  // camera gizmo: body + lens pointing along +z (Object3D.lookAt aims +z at the target)
  const gizmo = new THREE.Group();
  const gizmoMaterial = new THREE.MeshBasicMaterial();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.22), gizmoMaterial);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.16, 20), gizmoMaterial);
  lens.rotation.x = Math.PI / 2; lens.position.z = 0.18;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1), gizmoMaterial);
  top.position.set(-0.06, 0.14, -0.02);
  gizmo.add(body, lens, top);
  scene.add(gizmo);
  const lineMaterial = new THREE.LineDashedMaterial({ dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.85 });
  const sightLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]), lineMaterial);
  scene.add(sightLine);

  // larger invisible targets make the handles easy to grab with a finger
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitGeometry = new THREE.SphereGeometry(0.3, 12, 8);
  const hits = { horizontal: new THREE.Mesh(hitGeometry, hitMaterial), vertical: new THREE.Mesh(hitGeometry, hitMaterial),
                 zoom: new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), hitMaterial) };
  Object.entries(hits).forEach(([key, mesh]) => { mesh.userData.drag = key; scene.add(mesh); });

  function cameraDistance(zoom) { return FAR - (FAR - NEAR) * (zoom / 10); }

  function applyPalette() {
    palette = PALETTES[isLightTheme() ? "light" : "dark"];
    wireMaterial.color.setHex(palette.wire); wireMaterial.opacity = palette.wireOpacity;
    edgeMaterial.color.setHex(palette.edge);
    ringMaterial.color.setHex(palette.h); hHandle.material.color.setHex(palette.h); hHandle.halo.material.color.setHex(palette.h);
    arcMaterial.color.setHex(palette.v); trackMaterial.color.setHex(palette.v); trackMaterial.opacity = palette.track;
    vHandle.material.color.setHex(palette.v); vHandle.halo.material.color.setHex(palette.v);
    gizmoMaterial.color.setHex(palette.z); lineMaterial.color.setHex(palette.z);
    faceKeys.forEach((key, index) => {
      if (key === "pz") return;
      faceMaterials[index].map?.dispose();
      faceMaterials[index].map = labelTexture(FACE_LABELS[key], palette);
      faceMaterials[index].needsUpdate = true;
    });
    drawFront();
  }

  function drawFront(image) {
    const material = faceMaterials[4];
    material.map?.dispose();
    material.map = canvasTexture((ctx, size) => {
      ctx.fillStyle = palette.face; ctx.fillRect(0, 0, size, size);
      if (image) {
        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);   // cover the face
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      } else {
        ctx.fillStyle = palette.faceText; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = `600 ${size * 0.16}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
        ctx.fillText("正面", size / 2, size * 0.44);
        ctx.font = `500 ${size * 0.075}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
        ctx.fillText("上傳圖片後顯示", size / 2, size * 0.62);
      }
    }, 512);
    material.needsUpdate = true;
    requestRender();
  }

  function setImage(src) {
    imageSource = src || "";
    if (!imageSource) { drawFront(); return; }
    const image = new Image();
    image.onload = () => { if (src === imageSource) drawFront(image); };
    image.onerror = () => drawFront();
    image.src = imageSource;
  }

  const tmp = new THREE.Vector3();
  function update(next) {
    state = { ...state, ...next };
    const { horizontal: h, vertical: v, zoom } = state;
    track.geometry.dispose();
    track.geometry = new THREE.TubeGeometry(new ElevationArc(h, -30, 60), 48, 0.012, 6, false);
    arc.geometry.dispose();
    arc.visible = v - V_MIN >= 0.5;
    arc.geometry = arc.visible ? new THREE.TubeGeometry(new ElevationArc(h, V_MIN, v), 40, 0.03, 8, false) : new THREE.BufferGeometry();
    hHandle.mesh.position.copy(direction(h, V_MIN, tmp).multiplyScalar(R));
    vHandle.mesh.position.copy(direction(h, v, tmp).multiplyScalar(R));
    gizmo.position.copy(direction(h, v, tmp).multiplyScalar(cameraDistance(zoom)));
    gizmo.lookAt(0, 0, 0);
    sightLine.geometry.setFromPoints([gizmo.position.clone(), new THREE.Vector3()]);
    sightLine.computeLineDistances();
    hits.horizontal.position.copy(hHandle.mesh.position);
    hits.vertical.position.copy(vHandle.mesh.position);
    hits.zoom.position.copy(gizmo.position);
    requestRender();
  }

  function placeView() {
    view.position.copy(direction(viewAngles.az, viewAngles.el, tmp).multiplyScalar(VIEW_DISTANCE));
    view.lookAt(0, -0.05, 0);
  }

  let frame = 0;
  function requestRender() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      placeView();
      renderer.render(scene, view);
    });
  }

  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    view.aspect = width / height;
    view.updateProjectionMatrix();
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // pointer: grab a handle, or turn the preview
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag = null, last = null, hover = null;

  function ray(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    placeView();
    raycaster.setFromCamera(pointer, view);
    return raycaster.ray;
  }
  // The point whose centre is nearest the pointer on screen (within a finger-sized radius) wins; at -30° the
  // vertical point sits on the ring, and then it wins because the rest of the ring still sets the horizontal angle.
  // Away from the points, anywhere on the cyan ring starts a horizontal drag.
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const reach = event.pointerType === "mouse" ? 22 : 34;
    placeView();
    let best = null;
    for (const [key, mesh] of Object.entries(hits)) {
      const p = mesh.position.clone().project(view);
      const distance = Math.hypot((p.x + 1) / 2 * rect.width - x, (1 - p.y) / 2 * rect.height - y);
      const score = distance + p.z * 4 - (key === "vertical" ? 6 : 0);   // p.z: nearer the viewer = smaller
      if (distance <= reach && (!best || score < best.score)) best = { key, score };
    }
    if (best) return best.key;
    ray(event);
    return raycaster.intersectObject(ringHit, false).length ? "horizontal" : null;
  }
  function highlight(key) {
    hover = key;
    hHandle.mesh.scale.setScalar(key === "horizontal" ? 1.35 : 1);
    vHandle.mesh.scale.setScalar(key === "vertical" ? 1.35 : 1);
    gizmo.scale.setScalar(key === "zoom" ? 1.2 : 1);
    requestRender();
  }

  const plane = new THREE.Plane();
  const point = new THREE.Vector3();
  function dragTo(event) {
    const r = ray(event);
    const { horizontal: h } = state;
    if (drag === "horizontal") {
      plane.set(new THREE.Vector3(0, 1, 0), -RING_Y);
      if (!r.intersectPlane(plane, point) || point.x * point.x + point.z * point.z < 0.04) return;
      onDrag({ horizontal: (Math.round(Math.atan2(point.x, point.z) / DEG) + 360) % 360 });
    } else if (drag === "vertical") {
      plane.set(new THREE.Vector3(Math.cos(h * DEG), 0, -Math.sin(h * DEG)), 0);
      if (!r.intersectPlane(plane, point)) return;
      const along = point.x * Math.sin(h * DEG) + point.z * Math.cos(h * DEG);
      let v = Math.atan2(point.y, along) / DEG;
      if (v > 90) v = 60; else if (v < -90) v = -30;
      onDrag({ vertical: Math.round(Math.min(60, Math.max(-30, v))) });
    } else if (drag === "zoom") {
      // closest point on the camera's sight line (t * u, unit u) to the pointer ray (o + s * r, unit r):
      // minimising |o + s r - t u|^2 gives t = (u.o - (u.r)(r.o)) / (1 - (u.r)^2)
      const u = direction(h, state.vertical, new THREE.Vector3());
      const b = u.dot(r.direction), d = u.dot(r.origin), e = r.direction.dot(r.origin);
      const denominator = 1 - b * b;
      if (denominator < 1e-4) return;
      const t = Math.min(FAR, Math.max(NEAR, (d - b * e) / denominator));
      onDrag({ zoom: Math.round(((FAR - t) / (FAR - NEAR)) * 100) / 10 });
    }
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const key = isDisabled?.() ? null : pick(event);
    drag = key || "view";
    last = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    highlight(key);
    if (key === "horizontal") dragTo(event);   // a press on the ring jumps the point there
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", event => {
    if (!drag) {
      if (event.pointerType === "mouse") {
        const key = isDisabled?.() ? null : pick(event);
        if (key !== hover) highlight(key);
        canvas.style.cursor = key ? "grab" : "move";
      }
      return;
    }
    if (drag === "view") {
      viewAngles.az -= (event.clientX - last.x) * 0.45;
      viewAngles.el = Math.min(75, Math.max(6, viewAngles.el + (event.clientY - last.y) * 0.35));
      last = { x: event.clientX, y: event.clientY };
      requestRender();
      return;
    }
    dragTo(event);
  });
  const endDrag = event => {
    if (!drag) return;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    highlight(event.pointerType === "mouse" ? pick(event) : null);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { if (!drag && hover) highlight(null); });
  canvas.addEventListener("dblclick", () => { Object.assign(viewAngles, DEFAULT_VIEW); requestRender(); });

  new MutationObserver(() => { applyPalette(); requestRender(); })
    .observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

  applyPalette();
  update(state);
  resize();

  // Test hook (used by the automated page check): where a handle is on screen, in client pixels.
  Object.defineProperty(canvas, "a63ScreenPoint", { value: key => {
    const target = hits[key];
    if (!target) return null;
    placeView();
    const projected = target.position.clone().project(view);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (projected.x + 1) / 2 * rect.width, y: rect.top + (1 - projected.y) / 2 * rect.height };
  } });

  return {
    update,
    setImage,
    resetView: () => { Object.assign(viewAngles, DEFAULT_VIEW); requestRender(); },
  };
}
