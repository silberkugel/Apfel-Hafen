// Gast-Lese-Härtung: Rate-Limit und Kurzzeit-Cache für unauthentifizierte
// Status-Endpunkte (Unit) plus Meta-Prüfung, dass server.mjs beides nutzt.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createGuestReadCache, createGuestReadGuard, guestReadPaths } from "../lib/guest-read-guard.mjs";

test("Rate-Limit erlaubt maxRequests pro Adresse und antwortet danach ablehnend", () => {
  const guard = createGuestReadGuard({ windowMs: 60_000, maxRequests: 3 });
  assert.equal(guard("127.0.0.1"), true);
  assert.equal(guard("127.0.0.1"), true);
  assert.equal(guard("127.0.0.1"), true);
  assert.equal(guard("127.0.0.1"), false);
});

test("Rate-Limit zählt pro Adresse getrennt und lässt nach dem Fenster wieder zu", () => {
  const guard = createGuestReadGuard({ windowMs: 100, maxRequests: 1 });
  assert.equal(guard("a", 1_000), true);
  assert.equal(guard("b", 1_000), true);
  assert.equal(guard("a", 1_050), false);
  assert.equal(guard("a", 1_200), true);
});

test("Gelistete Gast-Pfade sind nur die redigierten Lese-Endpunkte", () => {
  assert.deepEqual([...guestReadPaths].sort(), ["/api/auth/session", "/api/containers", "/api/services/launchd", "/api/status"]);
});

test("Cache lädt einmal und bedient Wiederholungen ohne neuen Ladeaufruf", async () => {
  const cache = createGuestReadCache({ ttlMs: 1_000 });
  let calls = 0;
  const load = async () => ({ ok: ++calls });
  assert.deepEqual(await cache.read("k", load), { ok: 1 });
  assert.deepEqual(await cache.read("k", load), { ok: 1 });
  assert.equal(calls, 1);
});

test("Gleichzeitige Anfragen werden zu einem Ladevorgang zusammengefasst", async () => {
  const cache = createGuestReadCache({ ttlMs: 1_000 });
  let calls = 0;
  let resolveLoad;
  const load = () => {
    calls += 1;
    return new Promise((resolve) => { resolveLoad = resolve; });
  };
  const first = cache.read("k", load);
  const second = cache.read("k", load);
  await Promise.resolve(); // load wird als Mikrotask gestartet
  resolveLoad({ ok: true });
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(calls, 1);
});

test("Fehler werden nicht gecacht und der nächste Aufruf lädt erneut", async () => {
  const cache = createGuestReadCache({ ttlMs: 60_000 });
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("container list fehlgeschlagen");
    return "ok";
  };
  await assert.rejects(cache.read("k", load), /container list fehlgeschlagen/);
  assert.equal(await cache.read("k", load), "ok");
  assert.equal(calls, 2);
});

test("invalidate erzwingt einen Neuladen trotz frischer Einträge", async () => {
  const cache = createGuestReadCache({ ttlMs: 60_000 });
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cache.read("k", load), 1);
  cache.invalidate("k");
  assert.equal(await cache.read("k", load), 2);
});

test("server.mjs begrenzt und cacht alle Gast-Lesezugriffe", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /guestReadGuard = createGuestReadGuard\(/, "Rate-Limiter wird erzeugt");
  assert.match(server, /guestReadPaths\.has\(pathname\)[\s\S]*json\(res, 429/, "Gast-Limit antwortet 429");
  assert.match(server, /currentSession\(req\) \? await currentState\(\) : await guestContainersCache\.read\(/, "Containerliste: Gastpfad gecacht, Admin frisch");
  assert.match(server, /currentSession\(req\) \? await listLaunchdServices\(\{ runProcess \}\) : await guestLaunchdCache\.read\(/, "LaunchD-Liste: Gastpfad gecacht, Admin frisch");
  assert.match(server, /\["Zu viele Anfragen\. Bitte kurz warten\.", "Too many requests\. Wait a moment\."\]/, "429-Meldung ist zweisprachig hinterlegt");
});
