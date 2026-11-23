// Unit-Tests für die Gast-Lesehärtung: Kontenraster pro Adresse (429) und
// Kurzzeit-Cache, damit ein Gast ohne Sitzung keine Prozess-Lawine auslösen kann.
import assert from "node:assert/strict";
import test from "node:test";
import { createGuestReadCache, createGuestReadGuard, guestReadPaths, guestReadRateLimited } from "../lib/guest-read-guard.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("guest read guard allows exactly maxRequests within the window and blocks beyond", () => {
  const guard = createGuestReadGuard({ windowMs: 1_000, maxRequests: 3 });
  const now = 100_000;
  assert.equal(guard("1.2.3.4", now), true);
  assert.equal(guard("1.2.3.4", now + 1), true);
  assert.equal(guard("1.2.3.4", now + 2), true);
  assert.equal(guard("1.2.3.4", now + 3), false, "vierter Request im Fenster muss abgewiesen werden");
});

test("guest read guard reopens after the window passes", async () => {
  const guard = createGuestReadGuard({ windowMs: 50, maxRequests: 2 });
  assert.equal(guard("10.0.0.1"), true);
  assert.equal(guard("10.0.0.1"), true);
  assert.equal(guard("10.0.0.1"), false);
  await wait(70);
  assert.equal(guard("10.0.0.1"), true, "nach Ablauf des Fensters ist wieder Platz");
});

test("guest read guard isolates addresses so one client cannot lock out another", () => {
  const guard = createGuestReadGuard({ windowMs: 1_000, maxRequests: 1 });
  assert.equal(guard("192.168.1.10"), true);
  assert.equal(guard("192.168.1.10"), false);
  assert.equal(guard("192.168.1.11"), true, "andere Adresse bleibt unberührt");
});

test("guest read guard prunes stale addresses to bound memory growth", async () => {
  const guard = createGuestReadGuard({ windowMs: 20, maxRequests: 2 });
  guard("10.0.0.2");
  await wait(40);
  // Fresh traffic past the prune threshold must drop the stale address again.
  for (let i = 0; i < 1001; i += 1) guard(`10.0.${Math.floor(i / 256)}.${i % 256}`);
  assert.equal(guard("10.0.0.2"), true, "alte Adresse wurde entfernt und zählt neu");
});

test("guestReadRateLimited maps missing socket address to the shared local bucket", () => {
  const guard = createGuestReadGuard({ windowMs: 1_000, maxRequests: 1 });
  assert.equal(guestReadRateLimited(guard, {}), false, "erster_request");
  assert.equal(guestReadRateLimited(guard, {}), true, "zweiter_gast_ohne_addresse");
  assert.equal(guestReadRateLimited(guard, { socket: { remoteAddress: "::1" } }), false, "eigener_IP_bucket");
});

test("guest read paths are exactly the unauthenticated status endpoints", () => {
  assert.deepEqual([...guestReadPaths].sort(), [
    "/api/auth/session",
    "/api/containers",
    "/api/services/launchd",
    "/api/status",
  ]);
});

test("guest read cache serves repeats from memory and reloads only after the TTL", async () => {
  const cache = createGuestReadCache({ ttlMs: 50 });
  let loads = 0;
  const load = async () => ({ value: ++loads });
  assert.deepEqual(await cache.read("key", load), { value: 1 });
  assert.deepEqual(await cache.read("key", load), { value: 1 }, "TTL bedient aus dem Cache");
  await wait(70);
  assert.deepEqual(await cache.read("key", load), { value: 2 }, "nach TTL wird neu geladen");
});

test("guest read cache collapses concurrent loads into one pending request", async () => {
  const cache = createGuestReadCache({ ttlMs: 1_000 });
  let loads = 0;
  const load = () => new Promise((resolve) => setTimeout(() => resolve(++loads), 10));
  const [a, b] = await Promise.all([cache.read("key", load), cache.read("key", load)]);
  assert.equal(loads, 1, "parallele Gasts requests lösen genau einen Ladevorgang aus");
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("guest read cache never caches failures and invalidate forces a reload", async () => {
  const cache = createGuestReadCache({ ttlMs: 10_000 });
  let loads = 0;
  await assert.rejects(cache.read("key", () => Promise.reject(new Error("CLI-Fehler"))), /CLI-Fehler/);
  assert.equal(await cache.read("key", async () => ++loads), 1, "Fehler wird nicht gecacht");
  assert.equal(await cache.read("key", async () => ++loads), 1, "Erfolg wird gecacht");
  cache.invalidate("key");
  assert.equal(await cache.read("key", async () => ++loads), 2, "invalidate erzwingt Neuladen");
});
