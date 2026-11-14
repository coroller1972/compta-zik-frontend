import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("styles.css embeds docs/design/tokens.css verbatim", async () => {
  const [styles, tokens] = await Promise.all([read("src/styles.css"), read("docs/design/tokens.css")]);
  assert.ok(styles.includes(tokens.trimEnd()), "copier docs/design/tokens.css en tête de src/styles.css");
});

function themeBlock(tokens, selector) {
  const start = tokens.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `bloc ${selector} introuvable dans tokens.css`);
  const body = tokens.slice(start, tokens.indexOf("}", start));
  return body.slice(body.indexOf("{") + 1).trim().split("\n").map((line) => line.trim()).filter(Boolean);
}

test("le thème nuit automatique et le thème nuit forcé déclarent les mêmes valeurs", async () => {
  const tokens = await read("docs/design/tokens.css");
  const auto = themeBlock(tokens, ':root:not([data-theme="light"])');
  const forced = themeBlock(tokens, ':root[data-theme="dark"]');
  assert.ok(auto.length > 40, "bloc nuit automatique trop court");
  assert.deepEqual(forced, auto, "les deux blocs nuit de tokens.css doivent rester identiques (CSS sans build : pas de mise en commun possible)");
});

test("les alias de transition retirés ne reviennent pas", async () => {
  const styles = await read("src/styles.css");
  const legacy = styles.match(/var\(--(?:surface|panel|muted|accent|accent-soft|warning|danger|shadow|action|action-hover|action-soft)\)/g) || [];
  assert.deepEqual(legacy, [], "utiliser les jetons de tokens.css (--paper, --card, --ink-muted, --petrol, --petrol-tint, --brass, --brick)");
});
