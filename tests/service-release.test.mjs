import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Finder commands control the LaunchAgent instead of a foreground server", async () => {
  const start = await readFile(new URL("../Start-Apfel-Hafen.command", import.meta.url), "utf8");
  const stop = await readFile(new URL("../Stop-Apfel-Hafen.command", import.meta.url), "utf8");

  assert.match(start, /service-control\.mjs" start/);
  assert.doesNotMatch(start, /server\.mjs" &/);
  assert.match(stop, /service-control\.mjs" stop/);
  assert.doesNotMatch(stop, /lsof .*4173/);
});

test("release archive contains the service controller", async () => {
  const release = await readFile(new URL("../scripts/build-release.sh", import.meta.url), "utf8");
  assert.match(release, /ditto service-control\.mjs/);
});

test("administration save shows temporary button and toast feedback", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*?\}, 3000\)/);
  assert.match(source, /className="settings-toast"/);
  assert.match(source, /administrationSaved \? `✓ \$\{t\("savedShort"\)\}`/);
});

test("global help opens the harbor master getting-started guide", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /className="help-button"/);
  assert.match(source, /function GettingStarted/);
  assert.match(source, /Logbuch des Hafenmeisters/);
  assert.match(source, /globalen Volume-Pfad/);
  assert.match(source, /Container erstellen/);
});
