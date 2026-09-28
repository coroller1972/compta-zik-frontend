import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  normalizeTheme,
  readThemePreference,
  saveThemePreference,
} from "../src/theme.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

const brokenStorage = {
  getItem() { throw new Error("denied"); },
  setItem() { throw new Error("denied"); },
  removeItem() { throw new Error("denied"); },
};

test("unknown or missing values fall back to auto", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("sepia"), "auto");
  assert.equal(normalizeTheme(null), "auto");
  assert.equal(readThemePreference(memoryStorage()), "auto");
  assert.equal(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "dark" })), "dark");
  assert.equal(readThemePreference(brokenStorage), "auto");
});

test("light and dark set data-theme, auto removes it", () => {
  const root = { dataset: {} };
  applyThemePreference("dark", root);
  assert.equal(root.dataset.theme, "dark");
  applyThemePreference("light", root);
  assert.equal(root.dataset.theme, "light");
  applyThemePreference("auto", root);
  assert.equal("theme" in root.dataset, false);
});

test("saving remembers light and dark but forgets auto", () => {
  const storage = memoryStorage();
  const root = { dataset: {} };
  assert.equal(saveThemePreference("dark", { storage, root }), "dark");
  assert.equal(storage.values.get(THEME_STORAGE_KEY), "dark");
  assert.equal(saveThemePreference("auto", { storage, root }), "auto");
  assert.equal(storage.values.has(THEME_STORAGE_KEY), false);
  assert.equal("theme" in root.dataset, false);
});

test("an unavailable storage still applies the theme to the page", () => {
  const root = { dataset: {} };
  assert.equal(saveThemePreference("light", { storage: brokenStorage, root }), "light");
  assert.equal(root.dataset.theme, "light");
});

test("the head script applies the stored theme with the same key", async () => {
  const source = await readFile(new URL("../src/theme-init.js", import.meta.url), "utf8");
  assert.ok(source.includes(`"${THEME_STORAGE_KEY}"`));
  for (const [stored, expected] of [["dark", "dark"], ["light", "light"], ["sepia", undefined], [null, undefined]]) {
    const documentElement = { dataset: {} };
    const localStorage = memoryStorage(stored === null ? {} : { [THEME_STORAGE_KEY]: stored });
    vm.runInNewContext(source, { document: { documentElement }, localStorage });
    assert.equal(documentElement.dataset.theme, expected);
  }
  assert.doesNotThrow(() => vm.runInNewContext(source, { document: { documentElement: { dataset: {} } }, localStorage: brokenStorage }));
});
