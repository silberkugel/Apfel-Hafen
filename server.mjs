import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseContainers } from "./lib/container-parser.mjs";
import { buildCreateArgs, imageDigestFromInspect, pinnedImage, replacementSummary } from "./lib/recreate-args.mjs";
import { localizeServerMessage, requestLanguage } from "./lib/server-i18n.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || (isDev ? 4174 : 4173));
const containerCli = "/usr/local/bin/container";
const pamHelper = join(root, "auth", "pam-auth");
const checkedUpdates = new Map();
const sessions = new Map();
const loginAttempts = new Map();
const sessionDurationMs = 30 * 60 * 1000;
const serviceLabel = "de.containerzentrale.service";
const serviceDomain = `gui/${process.getuid()}`;

function runProcess(program, args, input = "", timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { shell: false, timeout });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function autostartStatus() {
  const result = await runProcess("/bin/launchctl", ["print-disabled", serviceDomain]);
  if (result.code !== 0) throw new Error(result.stderr || "Der Autostart-Status konnte nicht gelesen werden.");
  const escapedLabel = serviceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const disabled = new RegExp(`"${escapedLabel}"\\s*=>\\s*disabled`).test(result.stdout);
  return { enabled: !disabled };
}

async function setAutostart(enabled) {
  const action = enabled ? "enable" : "disable";
  const result = await runProcess("/bin/launchctl", [action, `${serviceDomain}/${serviceLabel}`]);
  if (result.code !== 0) throw new Error(result.stderr || `Der Autostart konnte nicht ${enabled ? "aktiviert" : "deaktiviert"} werden.`);
  return autostartStatus();
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function currentSession(req) {
  const token = cookies(req).cz_session;
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}

function requireLocalOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function allowLogin(req) {
  const key = req.socket.remoteAddress || "local";
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 5 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

async function authenticateAdministrator(username, password) {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username) || typeof password !== "string" || !password || password.length > 1024) {
    throw new Error("Benutzername oder Passwort ist ungültig.");
  }
  if (!existsSync(pamHelper)) throw new Error("Der lokale Anmeldehelfer fehlt.");

  const authentication = await runProcess(pamHelper, [username], password);
  if (authentication.code !== 0) throw new Error("Benutzername oder Passwort ist nicht korrekt.");

  const membership = await runProcess("/usr/bin/dsmemberutil", ["checkmembership", "-U", username, "-G", "admin"]);
  if (membership.code !== 0 || !/is a member/i.test(membership.stdout)) throw new Error("Nur macOS-Administratoren dürfen sich anmelden.");

  const userRecord = await runProcess("/usr/bin/dscl", [".", "-read", `/Users/${username}`, "RealName"]);
  const displayName = userRecord.code === 0
    ? userRecord.stdout.replace(/^RealName:\s*/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" ")
    : username;
  return { username, displayName: displayName || username };
}

function runContainer(args, timeout = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(containerCli, args, { shell: false, timeout });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", (error) => {
      if (error.code === "ENOENT") reject(new Error("Apple Container CLI wurde unter /usr/local/bin/container nicht gefunden."));
      else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error((stderr || stdout || `container wurde mit Status ${code} beendet.`).trim()));
    });
  });
}

async function currentState() {
  const output = await runContainer(["list", "--all", "--format", "json"]);
  return { records: JSON.parse(output || "[]"), containers: parseContainers(output) };
}

async function checkUpdate(name) {
  const { records, containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  const record = records.find((item) => (item.id || item.configuration?.id) === name);
  if (!selected || !record) throw new Error("Container ist nicht mehr vorhanden.");
  if (!selected.image || !selected.digest) throw new Error("Image-Referenz oder bisheriger Digest fehlt.");

  await runContainer(["image", "pull", "--progress", "plain", selected.image], 600_000);
  const newDigest = imageDigestFromInspect(await runContainer(["image", "inspect", selected.image]));
  const result = {
    available: newDigest !== selected.digest,
    oldDigest: selected.digest,
    newDigest,
    image: selected.image,
    summary: replacementSummary(record),
    checkedAt: Date.now(),
  };
  checkedUpdates.set(name, result);
  return result;
}

async function saveBackup(name, record, update) {
  const backupDir = join(root, "backups", name.replace(/[^a-z0-9._-]/gi, "_"));
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `${stamp}.json`);
  await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), update, container: record }, null, 2), { mode: 0o600 });
  return backupPath;
}

async function replaceContainer(name) {
  const update = checkedUpdates.get(name);
  if (!update || Date.now() - update.checkedAt > 60 * 60 * 1000) throw new Error("Bitte das Update unmittelbar vor dem Ersetzen erneut prüfen.");
  if (!update.available) throw new Error("Für diesen Container wurde kein neuer Image-Digest gefunden.");

  const { records, containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  const record = records.find((item) => (item.id || item.configuration?.id) === name);
  if (!selected || !record) throw new Error("Container ist nicht mehr vorhanden.");
  if (selected.digest !== update.oldDigest) throw new Error("Der Container hat sich seit der Update-Prüfung verändert. Bitte erneut prüfen.");

  const wasRunning = selected.status === "running";
  const backupPath = await saveBackup(name, record, update);
  const newArgs = buildCreateArgs(record, update.image);
  const rollbackArgs = buildCreateArgs(record, pinnedImage(update.image, update.oldDigest));
  const preflightName = `${name}-update-test-${Date.now().toString(36)}`;
  const preflightArgs = buildCreateArgs(record, update.image, preflightName);
  let oldDeleted = false;

  try {
    try {
      await runContainer(preflightArgs, 600_000);
      await runContainer(["delete", preflightName]);
    } catch (preflightError) {
      await runContainer(["delete", "--force", preflightName]).catch(() => {});
      throw new Error(`Sicherheitsprüfung fehlgeschlagen; der vorhandene Container wurde nicht verändert. Ursache: ${preflightError.message}`);
    }
    if (wasRunning) await runContainer(["stop", name]);
    await runContainer(["delete", name]);
    oldDeleted = true;
    await runContainer(newArgs, 600_000);
    if (wasRunning) await runContainer(["start", name]);
    checkedUpdates.delete(name);
    return { message: "Container wurde mit dem neuen Image neu erstellt.", backupPath };
  } catch (replacementError) {
    if (!oldDeleted) throw new Error(`Ersetzen wurde vor dem Löschen abgebrochen: ${replacementError.message}`);
    try {
      await runContainer(["delete", "--force", name]).catch(() => {});
      await runContainer(rollbackArgs, 600_000);
      if (wasRunning) await runContainer(["start", name]);
      throw new Error(`Das Update ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt. Ursache: ${replacementError.message}`);
    } catch (rollbackError) {
      if (/automatisch wiederhergestellt/.test(rollbackError.message)) throw rollbackError;
      throw new Error(`Update und automatische Wiederherstellung sind fehlgeschlagen. Die Sicherung liegt unter ${backupPath}. Ursache: ${rollbackError.message}`);
    }
  }
}

async function executeLifecycle(action, selected) {
  if (action === "start") return runContainer(["start", selected.name]);
  if (action === "stop") return runContainer(["stop", selected.name]);
  if (action === "restart") {
    if (selected.status === "running") await runContainer(["stop", selected.name]);
    await runContainer(["start", selected.name]);
    return "Container wurde neu gestartet.";
  }
  throw new Error("Unbekannte Aktion.");
}

function json(res, status, body, headers = {}) {
  const language = res.appLanguage || "de";
  if (body?.error) body = { ...body, error: localizeServerMessage(body.error, language) };
  if (body?.message) body = { ...body, message: localizeServerMessage(body.message, language) };
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Anfrage ist zu groß.");
  }
  return JSON.parse(raw || "{}");
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/auth/session") {
      const session = currentSession(req);
      return json(res, 200, session
        ? { authenticated: true, username: session.username, displayName: session.displayName, expiresAt: session.expiresAt }
        : { authenticated: false });
    }
    if (req.method === "POST" && pathname === "/api/auth/login") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Anmeldung ist nur von der lokalen Oberfläche erlaubt." });
      if (!allowLogin(req)) return json(res, 429, { error: "Zu viele Anmeldeversuche. Bitte fünf Minuten warten." });
      const body = await readBody(req);
      const password = String(body.password || "");
      body.password = "";
      const administrator = await authenticateAdministrator(String(body.username || ""), password);
      const token = randomBytes(32).toString("base64url");
      const session = { ...administrator, expiresAt: Date.now() + sessionDurationMs };
      sessions.set(token, session);
      return json(res, 200, { authenticated: true, ...session }, {
        "Set-Cookie": `cz_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationMs / 1000}`,
      });
    }
    if (req.method === "POST" && pathname === "/api/auth/logout") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Abmeldung ist nur von der lokalen Oberfläche erlaubt." });
      const token = cookies(req).cz_session;
      if (token) sessions.delete(token);
      return json(res, 200, { authenticated: false }, { "Set-Cookie": "cz_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
    }
    if (req.method === "GET" && pathname === "/api/containers") {
      const { containers } = await currentState();
      return json(res, 200, { containers, refreshedAt: new Date().toISOString() });
    }
    if (pathname === "/api/administration/autostart" && ["GET", "POST"].includes(req.method)) {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      if (req.method === "GET") return json(res, 200, await autostartStatus());
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Einstellungen dürfen nur von der lokalen Oberfläche geändert werden." });
      const body = await readBody(req);
      if (typeof body.enabled !== "boolean") return json(res, 400, { error: "Ungültige Autostart-Einstellung." });
      return json(res, 200, await setAutostart(body.enabled));
    }
    const match = pathname.match(/^\/api\/containers\/([^/]+)\/(start|stop|restart|update-check|replace)$/);
    if (req.method === "POST" && match) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Verwaltungsaktionen sind nur von der lokalen Oberfläche erlaubt." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(match[1]);
      const action = match[2];
      const body = await readBody(req);
      if (body.name !== name) return json(res, 400, { error: "Containername stimmt nicht überein." });
      if (action === "update-check") return json(res, 200, { ok: true, ...(await checkUpdate(name)) });
      if (action === "replace") return json(res, 200, { ok: true, ...(await replaceContainer(name)) });

      const { containers } = await currentState();
      const selected = containers.find((container) => container.name === name);
      if (!selected) return json(res, 404, { error: "Container ist nicht mehr vorhanden. Bitte Liste aktualisieren." });
      const output = await executeLifecycle(action, selected);
      return json(res, 200, { ok: true, message: output || "Aktion wurde ausgeführt." });
    }
    return json(res, 404, { error: "Nicht gefunden." });
  } catch (error) {
    const serviceHint = /connection|connect|not running|operation not permitted/i.test(error.message)
      ? " Prüfe mit „container system status“, ob der Apple-Containerdienst für diesen Benutzer läuft."
      : "";
    return json(res, 500, { error: `${error.message}${serviceHint}` });
  }
}

function serveStatic(req, res, pathname) {
  const dist = join(root, "dist");
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  let file = normalize(join(dist, relative));
  if (!file.startsWith(dist) || !existsSync(file)) file = join(dist, "index.html");
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  res.appLanguage = requestLanguage(req.headers["x-app-language"] || req.headers["accept-language"]);
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
  if (isDev) return json(res, 404, { error: "Frontend läuft im Entwicklungsmodus auf Port 5173." });
  return serveStatic(req, res, url.pathname);
}).listen(port, "127.0.0.1", () => console.log(`Containerzentrale: http://127.0.0.1:${port}`));
