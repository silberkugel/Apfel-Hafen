// Benutzertests gegen den laufenden Apfel-Hafen: ein Gast ohne Administrator-Sitzung.
// Nur lesende Anfragen und sichere Verweigerungen — es wird nichts verändert.
// Der Test wird übersprungen, wenn kein Server auf dem Port erreichbar ist.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as https from "node:https";

const port = Number(process.env.APFEL_TEST_PORT || 4173);
const host = "127.0.0.1";
const ADMIN_REQUIRED = "Bitte als macOS-Administrator anmelden.";

function request(method, path, { origin, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = https.request({
      host, port, path, method, rejectUnauthorized: false,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
        // Die echte UI sendet X-App-Language mit — ohne Header antwortet der Server englisch.
        "X-App-Language": "de",
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
      });
    });
    req.on("error", reject);
    req.setTimeout(20_000, () => req.destroy(new Error("timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

const localOrigin = `https://${host}:${port}`;
let serverOnline;
async function online() {
  if (serverOnline === undefined) {
    serverOnline = await request("GET", "/api/status").then((r) => r.status === 200, () => false);
  }
  return serverOnline;
}

test("Gast: /api/status ist erreichbar, aber ohne Admin-Details", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/api/status");
  assert.equal(res.status, 200);
  assert.equal(res.body.protocol, "HTTPS");
  assert.ok(res.body.version, "Versionsnummer für die Fußzeile");
  // Host-Info und CLI-Pfad liefert der Server nur an anmeldete Administratoren.
  assert.equal(res.body.listenHost, undefined);
  assert.equal(res.body.containerCli, undefined);
});

test("Gast: /api/auth/session meldet abgemeldet, ohne Session-Cookie zu setzen", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/api/auth/session");
  assert.equal(res.status, 200);
  assert.equal(res.body.authenticated, false);
  assert.ok(!String(res.headers["set-cookie"] || "").includes("apfel_session"), "kein Session-Cookie für Gäste");
});

test("Gast: Containerliste ist auf Name und Status redigiert", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/api/containers");
  if (res.status === 500) {
    // Passende Reaktion, wenn der Container-Dienst nicht läuft: Hinweis statt Daten.
    assert.match(String(res.body.error), /container system status|Container/i);
    return;
  }
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.containers));
  for (const container of res.body.containers) {
    assert.deepEqual(Object.keys(container).sort(), ["name", "status"]);
  }
});

test("Gast: LaunchD-Dienste ohne Programm-Pfade, Argumente und PIDs", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/api/services/launchd");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.services));
  const erlaubt = new Set(["id", "label", "kind", "scope", "loaded", "state", "running"]);
  for (const service of res.body.services) {
    for (const key of Object.keys(service)) assert.ok(erlaubt.has(key), `Gast sieht unerwartetes Feld: ${key}`);
    assert.equal(service.program, undefined);
    assert.equal(service.pid, undefined);
  }
});

test("Gast: alle Verwaltungs-Endpunkte antworten 401 mit Anmeldehinweis", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const faelle = [
    ["POST", "/api/containers/gast-test/start", { name: "gast-test" }],
    ["POST", "/api/containers/gast-test/stop", { name: "gast-test" }],
    ["DELETE", "/api/containers/gast-test", { confirmation: "gast-test" }],
    ["POST", "/api/services/launchd", { label: "de.apfel.gast-test" }],
    ["POST", "/api/services/launchd/de.apfel.gast-test/restart"],
    ["GET", "/api/administration/settings"],
    ["POST", "/api/administration/settings", { listenHost: "0.0.0.0" }],
    ["GET", "/api/administration/certificate"],
    ["GET", "/api/technology/overview"],
    ["POST", "/api/technology/prune", { action: "containers", confirmation: "containers" }],
    ["GET", "/api/system/overview"],
    ["POST", "/api/system/action", { action: "stop" }],
    ["GET", "/api/system/logs/snapshot"],
    ["GET", "/api/images"],
    ["GET", "/api/stacks"],
    ["POST", "/api/operations", { kind: "image.delete", reference: "nix" }],
    ["GET", "/api/system/logs/stream"],
  ];
  for (const [method, path, body] of faelle) {
    const res = await request(method, path, { origin: localOrigin, ...(body ? { body } : {}) });
    assert.equal(res.status, 401, `${method} ${path} muss einen Gast abweisen`);
    assert.equal(res.body.error, ADMIN_REQUIRED, `${method} ${path} ohne Standardmeldung`);
  }
});

test("Gast: fremde Herkunft (CSRF) wird vor der Anmeldung abgewiesen", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("POST", "/api/auth/login", { origin: "https://evil.example", body: { username: "apfel-gasttest-x", password: "x" } });
  assert.equal(res.status, 403);
  assert.match(String(res.body.error), /nur von der lokalen Oberfläche/);
});

test("Gast: falsche Zugangsdaten werden abgewiesen und führen nach fünf Versuchen in die Wartefrist", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  // Eigener Marken-Benutzername, damit kein echter Account in die Wartefrist läuft.
  const benutzer = `apfel-gasttest-${Date.now().toString(36)}`;
  for (let versuch = 1; versuch <= 5; versuch += 1) {
    const res = await request("POST", "/api/auth/login", { origin: localOrigin, body: { username: benutzer, password: "bewusst-falsch" } });
    assert.ok(res.status >= 400, `Versuch ${versuch}: Anmeldeversuch muss fehlschlagen`);
    assert.notEqual(res.body?.authenticated, true, "keine Session trotz falscher Zugangsdaten");
    assert.ok(!String(res.headers["set-cookie"] || "").includes("apfel_session="), "kein Session-Cookie");
  }
  const blockiert = await request("POST", "/api/auth/login", { origin: localOrigin, body: { username: benutzer, password: "bewusst-falsch" } });
  assert.equal(blockiert.status, 429);
  assert.match(String(blockiert.body.error), /Zu viele Anmeldeversuche/);
});

test("Gast: Abmeldung ist harmlos und räumt ein Session-Cookie auf", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("POST", "/api/auth/logout", { origin: localOrigin });
  assert.equal(res.status, 200);
  assert.equal(res.body.authenticated, false);
  assert.match(String(res.headers["set-cookie"] || ""), /Max-Age=0/);
});

test("Gast: unbekannte API-Pfade enden in einem sauberen 404", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/api/gibt-es-nicht");
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Nicht gefunden.");
  // Ohne Sprachheader antwortet der Server englisch (Standardfall ohne die UI).
  const en = await request("GET", "/api/gibt-es-nicht", { headers: { "X-App-Language": "en" } });
  assert.equal(en.status, 404);
  assert.equal(en.body.error, "Not found.");
});

test("Gast: OAuth/MCP-Tür bleibt ohne Token zu", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("POST", "/mcp", { origin: localOrigin, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  assert.ok([401, 415, 503].includes(res.status), `unerwarteter Status ${res.status}`);
  assert.ok(!Array.isArray(res.body?.result?.tools), "keine Werkzeugliste für Gäste");
});

test("Gast: die Startseite liefert HTML mit allen Sicherheits-Headern", async (t) => {
  if (!await online()) return t.skip("kein Server erreichbar");
  const res = await request("GET", "/");
  assert.equal(res.status, 200);
  assert.match(String(res.headers["content-type"]), /text\/html/);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "DENY");
  assert.match(String(res.headers["content-security-policy"]), /default-src 'self'/);
});
