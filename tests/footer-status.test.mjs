import test from "node:test";
import assert from "node:assert/strict";
import { footerStatus } from "../src/footer-status.mjs";

test("footer describes active containers and the last update", () => {
  const result = footerStatus({
    section: "containers", connected: true, loading: false, language: "de",
    containers: [{ status: "running" }, { status: "stopped" }], services: [],
    updatedAt: { containers: "2026-10-02T12:34:56Z" },
  });
  assert.equal(result.tone, "normal");
  assert.match(result.text, /^Verbunden · 1 Container aktiv · Aktualisiert /);
});

test("footer warns when Apple Container is stopped", () => {
  const result = footerStatus({ section: "technology", connected: true, language: "en", technology: { systemRunning: false, sampledAt: "2026-10-02T12:34:56Z" } });
  assert.equal(result.tone, "warning");
  assert.match(result.text, /Connected · Apple Container stopped · Updated/);
});

test("footer prioritizes a lost service connection", () => {
  assert.deepEqual(footerStatus({ connected: false, language: "de" }), { tone: "critical", text: "Verbindung zum Dienst unterbrochen" });
});

test("tools use the already known container state without waiting for technology metrics", () => {
  const result = footerStatus({ section: "tools", connected: true, language: "de", containers: [{ status: "running" }], updatedAt: { containers: "2026-10-02T12:34:56Z" } });
  assert.match(result.text, /^Verbunden · 1 Container aktiv · Aktualisiert /);
});
