import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("styles.css embeds docs/design/tokens.css verbatim", async () => {
  const [styles, tokens] = await Promise.all([read("src/styles.css"), read("docs/design/tokens.css")]);
  assert.ok(styles.includes(tokens.trimEnd()), "copier docs/design/tokens.css en tête de src/styles.css");
});
