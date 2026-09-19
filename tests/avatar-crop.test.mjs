import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarCropRect } from "../src/avatar-crop.mjs";

test("landscape and portrait photos start with a centered square", () => {
  assert.deepEqual(avatarCropRect({ width: 1200, height: 800 }), { x: 200, y: 0, size: 800 });
  assert.deepEqual(avatarCropRect({ width: 800, height: 1200 }), { x: 0, y: 200, size: 800 });
});

test("zoom preserves the chosen subject when it fits within the image", () => {
  assert.deepEqual(avatarCropRect({ width: 1200, height: 800, zoom: 2, centerX: 850, centerY: 300 }),
    { x: 650, y: 100, size: 400 });
});

test("dragging beyond any edge never exposes empty space", () => {
  for (const [centerX, centerY, x, y] of [
    [-1000, -1000, 0, 0], [2000, -1000, 800, 0],
    [-1000, 2000, 0, 400], [2000, 2000, 800, 400],
  ]) {
    assert.deepEqual(avatarCropRect({ width: 1200, height: 800, zoom: 2, centerX, centerY }), { x, y, size: 400 });
  }
});

test("zooming back out near an edge keeps the full square inside the photo", () => {
  assert.deepEqual(avatarCropRect({ width: 1200, height: 800, zoom: 1, centerX: 1100, centerY: 100 }),
    { x: 400, y: 0, size: 800 });
});

test("zoom is limited to the supported 100–400 percent range", () => {
  assert.deepEqual(avatarCropRect({ width: 800, height: 800, zoom: 0.5 }), { x: 0, y: 0, size: 800 });
  assert.deepEqual(avatarCropRect({ width: 800, height: 800, zoom: 10 }), { x: 300, y: 300, size: 200 });
});

test("invalid image dimensions and positions cannot produce an export rectangle", () => {
  for (const invalid of [{ width: 0 }, { height: -1 }, { width: Infinity }, { zoom: NaN }, { centerX: NaN }]) {
    assert.throws(() => avatarCropRect({ width: 800, height: 600, ...invalid }), RangeError);
  }
});
