// A6-3: the page's shot buckets must match ComfyUI's CameraAngle node (comfy_extras/nodes_camera_angle.py, 0.45.3).
import test from "node:test";
import assert from "node:assert/strict";
import { describeCamera, normalizeCamera, horizontalIndex, verticalIndex, distanceIndex, HORIZONTAL, VERTICAL, DISTANCE } from "../a6-3/camera-picker.js";

// [horizontal, vertical, zoom, prompt] produced by the node's own describe_camera_angle()
const NODE_CASES = [
  [0, 0, 5, "front view eye-level shot medium shot"], [22, 0, 5, "front view eye-level shot medium shot"],
  [23, 0, 5, "front-right quarter view eye-level shot medium shot"], [90, 0, 5, "right side view eye-level shot medium shot"],
  [180, 0, 5, "back view eye-level shot medium shot"], [270, 0, 5, "left side view eye-level shot medium shot"],
  [290, -3, 5, "left side view eye-level shot medium shot"], [337, 0, 5, "front-left quarter view eye-level shot medium shot"],
  [338, 0, 5, "front view eye-level shot medium shot"], [360, 0, 5, "front view eye-level shot medium shot"],
  [0, -30, 0, "front view low-angle shot wide shot"], [0, -16, 1.9, "front view low-angle shot wide shot"],
  [0, -15, 2, "front view eye-level shot medium shot"], [0, 14, 5.9, "front view eye-level shot medium shot"],
  [0, 15, 6, "front view elevated shot close-up"], [0, 44, 10, "front view elevated shot close-up"],
  [0, 45, 10, "front view high-angle shot close-up"], [0, 60, 10, "front view high-angle shot close-up"],
];

test("shot description matches the ComfyUI node", () => {
  for (const [horizontal, vertical, zoom, prompt] of NODE_CASES) {
    assert.equal(describeCamera({ horizontal, vertical, zoom }).prompt, prompt, `${horizontal}/${vertical}/${zoom}`);
  }
});

test("every quick button value lands in its own bucket", () => {
  HORIZONTAL.forEach((item, index) => assert.equal(horizontalIndex(item.value), index));
  VERTICAL.forEach((item, index) => assert.equal(verticalIndex(item.value), index));
  DISTANCE.forEach((item, index) => assert.equal(distanceIndex(item.value), index));
});

test("values are clamped and rounded like the server", () => {
  assert.deepEqual(normalizeCamera({ horizontal: 400, vertical: -90, zoom: 12 }), { horizontal: 360, vertical: -30, zoom: 10 });
  assert.deepEqual(normalizeCamera({ horizontal: 12.6, vertical: 7.4, zoom: 3.26 }), { horizontal: 13, vertical: 7, zoom: 3.3 });
  assert.deepEqual(normalizeCamera({ horizontal: "x" }), { horizontal: 45, vertical: 0, zoom: 5 });
});
