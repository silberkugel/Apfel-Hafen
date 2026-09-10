import { createServer } from "node:https";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { disabledFromLaunchctl, launchAgentPlist, programFromLaunchctl } from "./lib/autostart.mjs";
import { parseContainers } from "./lib/container-parser.mjs";
import { buildCreateArgs, editableContainerSettings, imageDigestFromInspect, pinnedImage, replacementSummary } from "./lib/recreate-args.mjs";
import { buildNewContainerArgs, parseImageNames, validateContainerDraft, validateContainerSettings } from "./lib/container-create.mjs";
import { dockerHubSearchInput, shouldPullImage, updateCheckResult } from "./lib/image-policy.mjs";
import { localListenHost, normalizeListenHost, requestMatchesOrigin } from "./lib/network-settings.mjs";
import { installCustomCertificate, loadTlsCertificate, removeCustomCertificate } from "./lib/tls-certificates.mjs";
import { prepareApplicationData } from "./lib/app-paths.mjs";
import { cleanupLaunchdService, createLaunchdService, executeLaunchdAction, findLaunchdService, listLaunchdServices, updateLaunchdService } from "./lib/launchd-services.mjs";
import { OperationStore } from "./lib/operation-store.mjs";
import { currentMcpProtocolVersion, dispatchMcpPayload, mcpBearerAuthorized, validMcpToken, validateModernMcpHeaders } from "./lib/mcp-server.mjs";
import { buildImageArgs, builderActionArgs, imageActionArgs, parseImages, parseRegistryList, registryAction, safeLogOptions, validateImageReference } from "./lib/container-operations.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const appPaths = await prepareApplicationData(root);
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || (isDev ? 4174 : 4173));
const sessionCookieName = isDev ? "apfel_dev_session" : "__Host-apfel_session";
const sessionCookieAttributes = isDev
  ? "HttpOnly; SameSite=Strict; Path=/"
  : "Secure; HttpOnly; SameSite=Strict; Path=/";
const containerCliCandidates = ["/usr/local/bin/container", "/opt/homebrew/bin/container", "/usr/bin/container"];
const containerCli = containerCliCandidates.find((candidate) => existsSync(candidate)) || "/usr/local/bin/container";
const pamHelper = join(root, "auth", "pam-auth");
const checkedUpdates = new Map();
const imageSearchCache = new Map();
const sessions = new Map();
const loginAttempts = new Map();
const operationStore = new OperationStore(join(appPaths.base, "operations.json"), containerCli);
await operationStore.load();
let systemStoppedByUser = false;
const sessionDurationMs = 30 * 60 * 1000;
const mcpTokenPath = join(appPaths.base, "mcp-token");
const mcpToken = await (async () => {
  if (process.env.APFEL_HAFEN_MCP_TOKEN) return String(process.env.APFEL_HAFEN_MCP_TOKEN);
  try {
    const tokenFile = await stat(mcpTokenPath);
    if ((tokenFile.mode & 0o077) !== 0) {
      console.error(`Apfel-Hafen: MCP token file must have mode 0600: ${mcpTokenPath}`);
      return "";
    }
    return (await readFile(mcpTokenPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") console.error(`Apfel-Hafen: MCP token could not be read: ${error.message}`);
    return "";
  }
})();
const serviceLabel = "de.apfel-hafen.service";
const serviceDomain = `gui/${process.getuid()}`;
const launchAgentPath = join(homedir(), "Library", "LaunchAgents", `${serviceLabel}.plist`);
const serviceLogDir = join(homedir(), "Library", "Logs", "Apfel-Hafen");
const managedByApp = process.env.APFEL_HAFEN_MANAGED_BY_APP === "1";
const bundledNode = join(root, "runtime", "node");
const expectedNode = existsSync(bundledNode) ? bundledNode : process.execPath;
const expectedServer = join(root, "server.mjs");
const settingsPath = appPaths.settings;
const defaultSettings = { volumeBasePath: join(homedir(), "ContainerVolumes"), listenHost: localListenHost };
const englishMessages = new Map([
  ["Die Administrationseinstellungen konnten nicht gelesen werden.", "Administration settings could not be read."],
  ["Bitte einen gültigen absoluten Volume-Pfad angeben.", "Enter a valid absolute volume path."],
  ["Ungültige Einstellung für den Netzwerkzugriff.", "Invalid network access setting."],
  ["Das Zertifikat ist ungültig.", "The certificate is invalid."],
  ["Der private Schlüssel ist ungültig.", "The private key is invalid."],
  ["Zertifikat und privater Schlüssel passen nicht zusammen.", "The certificate and private key do not match."],
  ["Das Zertifikat ist noch nicht gültig.", "The certificate is not valid yet."],
  ["Das Zertifikat ist abgelaufen.", "The certificate has expired."],
  ["Der Ordnerdialog konnte nicht geöffnet werden.", "The folder picker could not be opened."],
  ["Der Autostart-Status konnte nicht gelesen werden.", "The automatic startup status could not be read."],
  ["Benutzername oder Passwort ist ungültig.", "The username or password is invalid."],
  ["Der lokale Anmeldehelfer fehlt.", "The local authentication helper is missing."],
  ["Benutzername oder Passwort ist nicht korrekt.", "The username or password is incorrect."],
  ["Nur macOS-Administratoren dürfen sich anmelden.", "Only macOS administrators may sign in."],
  ["Apple Container CLI wurde unter /usr/local/bin/container nicht gefunden.", "Apple Container CLI was not found at /usr/local/bin/container."],
  ["Die öffentliche Image-Suche ist zurzeit nicht erreichbar.", "Public image search is currently unavailable."],
  ["Container wurde erstellt und gestartet.", "The container was created and started."],
  ["Container wurde erstellt.", "The container was created."],
  ["Container ist nicht mehr vorhanden.", "The container no longer exists."],
  ["Image-Referenz fehlt.", "The image reference is missing."],
  ["Einstellungen wurden übernommen.", "Settings were applied."],
  ["Einstellungen wurden übernommen und der Container wurde wieder gestartet.", "Settings were applied and the container was started again."],
  ["Der eingegebene Containername stimmt nicht überein.", "The entered container name does not match."],
  ["Container und zugehörige Volume-Daten wurden gelöscht.", "The container and its associated volume data were deleted."],
  ["Container wurde gelöscht.", "The container was deleted."],
  ["Image-Referenz oder bisheriger Digest fehlt.", "The image reference or previous digest is missing."],
  ["Lokales Image ist aktuell. Für lokale Images ist kein Registry-Update verfügbar.", "The local image is current. Registry updates are not available for local images."],
  ["Kein Image-Update verfügbar.", "No image update is available."],
  ["Image-Update ist verfügbar.", "An image update is available."],
  ["Bitte das Update unmittelbar vor dem Ersetzen erneut prüfen.", "Check for updates again immediately before replacing the container."],
  ["Für diesen Container wurde kein neuer Image-Digest gefunden.", "No new image digest was found for this container."],
  ["Der Container hat sich seit der Update-Prüfung verändert. Bitte erneut prüfen.", "The container changed after the update check. Check again."],
  ["Container wurde mit dem neuen Image neu erstellt.", "The container was recreated with the new image."],
  ["Container wurde neu gestartet.", "The container was restarted."],
  ["Die Konsole ist nur für laufende Container verfügbar.", "The console is only available for running containers."],
  ["Das Terminalfenster konnte nicht geöffnet werden.", "The Terminal window could not be opened."],
  ["Unbekannte Aktion.", "Unknown action."],
  ["Anfrage ist zu groß.", "The request is too large."],
  ["Anmeldung ist nur von der lokalen Oberfläche erlaubt.", "Sign-in is allowed only from the local interface."],
  ["Zu viele Anmeldeversuche. Bitte fünf Minuten warten.", "Too many sign-in attempts. Wait five minutes."],
  ["Abmeldung ist nur von der lokalen Oberfläche erlaubt.", "Sign-out is allowed only from the local interface."],
  ["Bitte als macOS-Administrator anmelden.", "Sign in as a macOS administrator."],
  ["Einstellungen dürfen nur von der lokalen Oberfläche geändert werden.", "Settings may be changed only from the local interface."],
  ["Container-Einstellungen dürfen nur von der lokalen Oberfläche geändert werden.", "Container settings may be changed only from the local interface."],
  ["Ungültige Autostart-Einstellung.", "Invalid automatic startup setting."],
  ["Der Ordnerdialog darf nur von der lokalen Oberfläche geöffnet werden.", "The folder picker may be opened only from the local interface."],
  ["Container dürfen nur von der lokalen Oberfläche erstellt werden.", "Containers may be created only from the local interface."],
  ["Container dürfen nur von der lokalen Oberfläche gelöscht werden.", "Containers may be deleted only from the local interface."],
  ["Verwaltungsaktionen sind nur von der lokalen Oberfläche erlaubt.", "Administrative actions are allowed only from the local interface."],
  ["Containername stimmt nicht überein.", "The container name does not match."],
  ["Container ist nicht mehr vorhanden. Bitte Liste aktualisieren.", "The container no longer exists. Refresh the list."],
  ["Aktion wurde ausgeführt.", "The action was completed."],
  ["Nicht gefunden.", "Not found."],
  ["Frontend läuft im Entwicklungsmodus auf Port 5173.", "The frontend is running in development mode on port 5173."],
  ["Die Containerliste hat ein unerwartetes Format.", "The container list has an unexpected format."],
  ["Der Digest des geladenen Images konnte nicht ermittelt werden.", "The digest of the pulled image could not be determined."],
  ["Container-ID oder Image fehlt in der Sicherung.", "The container ID or image is missing from the backup."],
  ["Zusätzliche Gruppen können noch nicht sicher rekonstruiert werden.", "Supplemental groups cannot yet be reconstructed safely."],
  ["Sysctl-Einstellungen können noch nicht sicher rekonstruiert werden.", "Sysctl settings cannot yet be reconstructed safely."],
  ["Eine Mount-Konfiguration ist unvollständig.", "A mount configuration is incomplete."],
  ["Der globale Volume-Pfad muss absolut sein.", "The global volume path must be absolute."],
  ["Der Volume-Unterordner muss relativ sein.", "The volume subfolder must be relative."],
  ["Der Volume-Unterordner liegt außerhalb des globalen Pfads.", "The volume subfolder is outside the global path."],
  ["Der Containername darf nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich enthalten.", "The container name may contain only letters, numbers, periods, underscores, and hyphens."],
  ["Bitte eine gültige Image-Referenz angeben.", "Enter a valid image reference."],
  ["Es sind höchstens 128 Variablen erlaubt.", "A maximum of 128 variables is allowed."],
  ["Es sind höchstens 32 Portfreigaben erlaubt.", "A maximum of 32 port mappings is allowed."],
  ["Als Protokoll ist nur TCP oder UDP erlaubt.", "Only TCP or UDP is allowed as a protocol."],
  ["Es sind höchstens 16 Volumes erlaubt.", "A maximum of 16 volumes is allowed."],
  ["Der Container-Pfad eines Volumes muss absolut sein.", "A volume's container path must be absolute."],
  ["Der Host-Pfad eines Volumes muss absolut sein.", "A volume's host path must be absolute."],
  ["Ein Container mit diesem Namen ist bereits vorhanden.", "A container with this name already exists."],
  ["Das Startintervall muss zwischen 1 Sekunde und 365 Tagen liegen.", "The start interval must be between 1 second and 365 days."],
  ["Es sind höchstens 32 kalenderbasierte Startzeiten erlaubt.", "A maximum of 32 calendar-based start times is allowed."],
  ["Der Wochentag der Startzeit ist ungültig.", "The start time weekday is invalid."],
  ["Kalenderbasierte Startzeiten benötigen eine gültige Uhrzeit.", "Calendar-based start times require a valid time."],
  ["Dieser LaunchAgent enthält Startregeln, die nicht verlustfrei bearbeitet werden können.", "This LaunchAgent contains launch rules that cannot be edited without data loss."],
]);

function requestLanguage(req) {
  const selected = String(req.headers["x-app-language"] || "").toLowerCase();
  if (selected === "de" || selected === "en") return selected;
  return String(req.headers["accept-language"] || "").toLowerCase().startsWith("de") ? "de" : "en";
}

function englishMessage(message) {
  if (englishMessages.has(message)) return englishMessages.get(message);
  return String(message)
    .replace(/^(.+) ist ungültig\.$/, "$1 is invalid.")
    .replace(/^(.+) muss zwischen 1 und 65535 liegen\.$/, "$1 must be between 1 and 65535.")
    .replace(/^CPU-Anzahl muss zwischen 1 und 256 liegen\.$/, "CPU count must be between 1 and 256.")
    .replace(/^CPU-Anzahl muss eine ganze Zahl sein\.$/, "CPU count must be a whole number.")
    .replace(/^Arbeitsspeicher \(MB\) muss zwischen 64 und 1048576 liegen\.$/, "Memory (MB) must be between 64 and 1048576.")
    .replace(/^Arbeitsspeicher \(MB\) muss eine ganze Zahl sein\.$/, "Memory (MB) must be a whole number.")
    .replace(/^Der Variablenname „(.+)“ ist ungültig oder doppelt\.$/, "The variable name ‘$1’ is invalid or duplicated.")
    .replace(/^Der Wert von „(.+)“ ist zu lang\.$/, "The value of ‘$1’ is too long.")
    .replace(/^Der externe Port (.+) ist bereits belegt\.$/, "External port $1 is already in use.")
    .replace(/^Der Container konnte nicht gestartet werden\. Er bleibt für die Fehlersuche erhalten; öffne beim Container „Startprotokoll anzeigen“\. Ursache: /, "The container could not be started. It remains available for troubleshooting; choose ‘Show startup log’ for the container. Cause: ")
    .replace(/^Der Container konnte nicht gestartet werden und wurde zurückgerollt\. Ursache: /, "The container could not be started and was rolled back. Cause: ")
    .replace(/^Sicherheitsprüfung fehlgeschlagen; der vorhandene Container wurde nicht verändert\. Ursache: /, "The safety check failed; the existing container was not changed. Cause: ")
    .replace(/^Ersetzen wurde vor dem Löschen abgebrochen: /, "Replacement was canceled before deletion: ")
    .replace(/^Das Update ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt\. Ursache: /, "The update failed; the previous container was restored automatically. Cause: ")
    .replace(/^Update und automatische Wiederherstellung sind fehlgeschlagen\. Die Sicherung liegt unter (.+)\. Ursache: /, "The update and automatic recovery failed. The backup is stored at $1. Cause: ")
    .replace(/^Änderung wurde vor dem Löschen abgebrochen: /, "The change was canceled before deletion: ")
    .replace(/^Die Änderung ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt\. Ursache: /, "The change failed; the previous container was automatically restored. Cause: ")
    .replace(/^Änderung und automatische Wiederherstellung sind fehlgeschlagen\. Die Sicherung liegt unter (.+)\. Ursache: /, "The change and automatic recovery failed. The backup is stored at $1. Cause: ")
    .replace(/^Der Autostart konnte nicht aktiviert werden\./, "Automatic startup could not be enabled.")
    .replace(/^Der Autostart konnte nicht deaktiviert werden\./, "Automatic startup could not be disabled.")
    .replace(/ Prüfe mit „container system status“, ob der Apple-Containerdienst für diesen Benutzer läuft\.$/, " Check with ‘container system status’ whether the Apple container service is running for this user.");
}

async function readSettings() {
  try {
    const stored = JSON.parse(await readFile(settingsPath, "utf8"));
    return { ...defaultSettings, ...stored, listenHost: normalizeListenHost(stored.listenHost) };
  } catch (error) {
    if (error.code === "ENOENT") return { ...defaultSettings };
    throw new Error("Die Administrationseinstellungen konnten nicht gelesen werden.");
  }
}

async function saveSettings(settings) {
  await mkdir(appPaths.base, { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

async function setVolumeBasePath(value) {
  const volumeBasePath = String(value || "").trim();
  if (!isAbsolute(volumeBasePath) || volumeBasePath.length > 500) throw new Error("Bitte einen gültigen absoluten Volume-Pfad angeben.");
  await mkdir(volumeBasePath, { recursive: true });
  const settings = { ...(await readSettings()), volumeBasePath: resolve(volumeBasePath) };
  await saveSettings(settings);
  return settings;
}

async function selectVolumeBasePath(language) {
  const prompt = language === "en" ? "Select the global folder for container volumes" : "Globalen Ordner für Container-Volumes auswählen";
  const result = await runProcess("/usr/bin/osascript", [
    "-e", `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`,
  ], "", 300_000);
  if (result.code !== 0) {
    if (/User canceled/i.test(result.stderr)) return { canceled: true };
    throw new Error(result.stderr || "Der Ordnerdialog konnte nicht geöffnet werden.");
  }
  return { canceled: false, volumeBasePath: resolve(result.stdout) };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function openContainerConsole(name) {
  const { containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  if (!selected) throw new Error("Container ist nicht mehr vorhanden.");
  if (selected.status !== "running") throw new Error("Die Konsole ist nur für laufende Container verfügbar.");

  const consoleCommands = ["sh", "bash", "ash", "python3", "python"];
  const execPrefix = `${shellQuote(containerCli)} exec --interactive --tty ${shellQuote(name)}`;
  const command = `${consoleCommands.map((executable) => `exec ${execPrefix} ${shellQuote(executable)}`).join(" || ")} || { printf '%s\\n' 'Dieser Container enthält keine unterstützte interaktive Shell oder Python-Konsole.'; exit 1; }`;
  const result = await runProcess("/usr/bin/osascript", ["-e", `tell application "Terminal" to do script ${JSON.stringify(command)}`]);
  if (result.code !== 0) throw new Error(result.stderr || "Das Terminalfenster konnte nicht geöffnet werden.");
  return { message: "Terminalfenster wurde geöffnet." };
}

async function openContainerLogs(name) {
  const { containers } = await currentState();
  if (!containers.some((container) => container.name === name)) throw new Error("Container ist nicht mehr vorhanden.");

  const [bootResult, outputResult] = await Promise.allSettled([
    runContainer(["logs", "--boot", name]),
    runContainer(["logs", "-n", "200", name]),
  ]);
  const readableLog = (result) => {
    const value = result.status === "fulfilled" ? result.value : result.reason?.message;
    return String(value || "").slice(-100_000);
  };
  return { name, bootLog: readableLog(bootResult), outputLog: readableLog(outputResult) };
}

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

function streamContainerLogs(req, res, name, options, system = false) {
  if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
  const { tail, boot } = safeLogOptions(options);
  if (!system && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) throw new Error("Invalid container ID.");
  const args = system ? ["system", "logs", "--follow"] : ["logs", "--follow", "-n", String(tail), ...(boot ? ["--boot"] : []), name];
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const child = spawn(containerCli, args, { shell: false });
  const send = (event, value) => !res.destroyed && !res.writableEnded && res.write(`event: ${event}\ndata: ${JSON.stringify(String(value))}\n\n`);
  child.stdout.on("data", (data) => send("log", data));
  child.stderr.on("data", (data) => send("log", data));
  child.on("error", (error) => { send("error", error.message); res.end(); });
  child.on("close", (code) => { send("end", code); res.end(); });
  const timer = setTimeout(() => child.kill("SIGTERM"), 10 * 60 * 1000);
  const sessionTimer = setInterval(() => { if (!currentSession(req)) { child.kill("SIGTERM"); res.end(); } }, 5000);
  res.on("close", () => { clearTimeout(timer); clearInterval(sessionTimer); if (!child.killed) child.kill("SIGTERM"); });
}

async function autostartStatus() {
  if (managedByApp) return { enabled: true, installed: true, running: true, configuredForCurrentInstallation: true, updatePending: false, managedByApp: true };
  const disabledResult = await runProcess("/bin/launchctl", ["print-disabled", serviceDomain]);
  if (disabledResult.code !== 0) throw new Error(disabledResult.stderr || "Der Autostart-Status konnte nicht gelesen werden.");
  const runningResult = await runProcess("/bin/launchctl", ["print", `${serviceDomain}/${serviceLabel}`]);
  const running = runningResult.code === 0;
  const activeProgram = running ? programFromLaunchctl(runningResult.stdout) : "";
  const installed = existsSync(launchAgentPath);
  const configuredResult = installed ? await runProcess("/usr/bin/plutil", ["-extract", "ProgramArguments.0", "raw", launchAgentPath]) : { code: 1, stdout: "" };
  const configuredProgram = configuredResult.code === 0 ? configuredResult.stdout : "";
  return { enabled: installed && !disabledFromLaunchctl(disabledResult.stdout, serviceLabel), installed, running, configuredForCurrentInstallation: installed && configuredProgram === expectedNode, updatePending: running && activeProgram !== expectedNode, managedByApp: false };
}

async function setAutostart(enabled) {
  if (managedByApp) throw new Error("Der Hintergrunddienst wird von der Apfel-Hafen-App verwaltet.");
  if (enabled) {
    await mkdir(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
    await mkdir(serviceLogDir, { recursive: true });
    await writeFile(launchAgentPath, launchAgentPlist({ label: serviceLabel, nodePath: expectedNode, serverPath: expectedServer, stdoutPath: join(serviceLogDir, "service.log"), stderrPath: join(serviceLogDir, "service-error.log") }), { mode: 0o644 });
    await chmod(launchAgentPath, 0o644);
  }
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
  const token = cookies(req)[sessionCookieName];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}

function requireLocalOrigin(req) {
  if (isDev && req.headers.origin === "http://127.0.0.1:5173") return true;
  return requestMatchesOrigin(req.headers.origin, req.headers.host);
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

function runContainerOnce(args, timeout = 120_000) {
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

let containerSystemRecovery = null;

async function recoverContainerSystem() {
  if (!containerSystemRecovery) {
    containerSystemRecovery = runContainerOnce(["system", "start"], 120_000)
      .finally(() => { containerSystemRecovery = null; });
  }
  return containerSystemRecovery;
}

async function runContainer(args, timeout = 120_000) {
  try {
    return await runContainerOnce(args, timeout);
  } catch (error) {
    if (systemStoppedByUser || args[0] === "system" || !/apiserver|connection|connect|not running|operation not permitted/i.test(error.message)) throw error;
    await recoverContainerSystem();
    return runContainerOnce(args, timeout);
  }
}

async function currentState() {
  const output = await runContainer(["list", "--all", "--format", "json"]);
  return { records: JSON.parse(output || "[]"), containers: parseContainers(output) };
}

function mcpContainerName(args) {
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some((key) => key !== "name")) {
    throw new Error("Exactly one container name must be provided.");
  }
  const name = String(args.name || "");
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name)) throw new Error("The container name is invalid.");
  return name;
}

async function invokeMcpTool(tool, args) {
  const startedAt = Date.now();
  const name = tool === "list_containers" ? "" : mcpContainerName(args);
  try {
    if (tool === "list_containers") {
      if (Object.keys(args).length) throw new Error("This tool does not accept arguments.");
      const { containers } = await currentState();
      return { containers, refreshedAt: new Date().toISOString() };
    }

    if (tool === "get_container_status") {
      const { containers } = await currentState();
      const container = containers.find((item) => item.name === name);
      if (!container) throw new Error("Container does not exist.");
      return { container, refreshedAt: new Date().toISOString() };
    }
    if (tool === "get_container_logs") return openContainerLogs(name);
    if (tool === "check_image_update") return checkUpdate(name);

    if (["start_container", "stop_container", "restart_container"].includes(tool)) {
      const { containers } = await currentState();
      const selected = containers.find((item) => item.name === name);
      if (!selected) throw new Error("Container does not exist.");
      const action = tool.replace("_container", "");
      const output = await executeLifecycle(action, selected);
      return { ok: true, name, action, message: output || "Action completed." };
    }

    throw new Error("Unknown MCP tool.");
  } finally {
    console.log(JSON.stringify({ event: "mcp_tool_call", tool, container: name || undefined, durationMs: Date.now() - startedAt, at: new Date().toISOString() }));
  }
}

async function imageNames() {
  return parseImageNames(await runContainer(["image", "list", "--format", "json"]));
}

async function searchImages(query) {
  const input = dockerHubSearchInput(query);
  if (!input) return [];
  const cacheKey = `${input.query}|${input.directReference?.reference || ""}`;
  const cached = imageSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) return cached.results;

  const url = new URL("https://hub.docker.com/v2/search/repositories/");
  url.searchParams.set("query", input.query);
  url.searchParams.set("page_size", "12");
  let body;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Apfel-Hafen/1.0" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("Die öffentliche Image-Suche ist zurzeit nicht erreichbar.");
    body = await response.json();
  } catch (error) {
    if (input.directReference) return [input.directReference];
    throw error;
  }
  const searchedResults = (Array.isArray(body.results) ? body.results : []).map((item) => {
    const rawName = String(item.repo_name || [item.namespace, item.name].filter(Boolean).join("/") || item.name || "").replace(/^docker\.io\//, "");
    const official = Boolean(item.is_official) || rawName.startsWith("library/");
    const repository = official ? rawName.replace(/^library\//, "") : rawName;
    return {
      name: repository,
      reference: official ? `docker.io/library/${repository}:latest` : `docker.io/${repository}:latest`,
      description: String(item.short_description || item.description || "").slice(0, 240),
      official,
      pulls: Number(item.pull_count || 0),
      stars: Number(item.star_count || 0),
    };
  }).filter((item) => item.name && !item.name.includes(" "));
  const results = input.directReference
    ? [input.directReference, ...searchedResults.filter((item) => item.reference !== input.directReference.reference)]
    : searchedResults;
  imageSearchCache.set(cacheKey, { createdAt: Date.now(), results });
  return results;
}

async function createContainer(input) {
  const { records, containers } = await currentState();
  const settings = await readSettings();
  const occupiedPorts = containers.flatMap((container) => container.ports);
  const draft = validateContainerDraft(input, settings.volumeBasePath, occupiedPorts);
  if (records.some((item) => String(item.id || item.configuration?.id) === draft.name)) throw new Error("Ein Container mit diesem Namen ist bereits vorhanden.");
  for (const volume of draft.volumes) await mkdir(volume.source, { recursive: true });
  await runContainer(buildNewContainerArgs(draft), 600_000);
  try {
    if (draft.start) await runContainer(["start", draft.name]);
  } catch (error) {
    throw new Error(`Der Container konnte nicht gestartet werden. Er bleibt für die Fehlersuche erhalten; öffne beim Container „Startprotokoll anzeigen“. Ursache: ${error.message}`);
  }
  return { message: draft.start ? "Container wurde erstellt und gestartet." : "Container wurde erstellt." };
}

async function deleteContainer(name, input) {
  const { records, containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  const record = records.find((item) => String(item.id || item.configuration?.id) === name);
  if (!selected || !record) throw new Error("Container ist nicht mehr vorhanden.");
  if (input?.confirmation !== name) throw new Error("Der eingegebene Containername stimmt nicht überein.");

  const settings = await readSettings();
  const removableSources = (record.configuration?.mounts || []).map((mount) => String(mount.source || "")).filter((source) => {
    if (!source || !isAbsolute(source)) return false;
    const relation = relative(resolve(settings.volumeBasePath), resolve(source));
    return relation && !relation.startsWith("..") && !isAbsolute(relation);
  });
  await runContainer(["delete", ...(selected.status === "running" ? ["--force"] : []), name]);
  if (input?.deleteVolumes) {
    for (const source of removableSources) await rm(source, { recursive: true, force: true });
  }
  checkedUpdates.delete(name);
  return { message: input?.deleteVolumes ? "Container und zugehörige Volume-Daten wurden gelöscht." : "Container wurde gelöscht." };
}

async function checkUpdate(name) {
  const { records, containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  const record = records.find((item) => (item.id || item.configuration?.id) === name);
  if (!selected || !record) throw new Error("Container ist nicht mehr vorhanden.");
  if (!selected.image || !selected.digest) throw new Error("Image-Referenz oder bisheriger Digest fehlt.");

  if (shouldPullImage(selected.image)) {
    await runContainer(["image", "pull", "--progress", "plain", selected.image], 600_000);
  }
  const newDigest = imageDigestFromInspect(await runContainer(["image", "inspect", selected.image]));
  const check = updateCheckResult(selected.image, selected.digest, newDigest);
  const result = {
    ...check,
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
  const backupDir = join(appPaths.backups, name.replace(/[^a-z0-9._-]/gi, "_"));
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

async function containerSettings(name) {
  const { records } = await currentState();
  const record = records.find((item) => String(item.id || item.configuration?.id) === name);
  if (!record) throw new Error("Container ist nicht mehr vorhanden.");
  return editableContainerSettings(record);
}

async function updateContainerSettings(name, input) {
  const { records, containers } = await currentState();
  const selected = containers.find((container) => container.name === name);
  const record = records.find((item) => String(item.id || item.configuration?.id) === name);
  if (!selected || !record) throw new Error("Container ist nicht mehr vorhanden.");

  const occupiedPorts = containers.filter((container) => container.name !== name).flatMap((container) => container.ports);
  const settings = validateContainerSettings(input, occupiedPorts);
  const wasRunning = selected.status === "running";
  const image = String(record.configuration?.image?.reference || selected.image || "");
  if (!image) throw new Error("Image-Referenz fehlt.");
  const backupPath = await saveBackup(name, record, { type: "settings", requestedAt: new Date().toISOString() });
  const createArgs = buildCreateArgs(record, image, null, settings);
  const rollbackImage = selected.digest ? pinnedImage(image, selected.digest) : image;
  const rollbackArgs = buildCreateArgs(record, rollbackImage);
  const preflightName = `${name}-settings-test-${Date.now().toString(36)}`;
  const preflightArgs = buildCreateArgs(record, image, preflightName, settings);
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
    await runContainer(createArgs, 600_000);
    if (wasRunning) await runContainer(["start", name]);
    checkedUpdates.delete(name);
    return { message: wasRunning ? "Einstellungen wurden übernommen und der Container wurde wieder gestartet." : "Einstellungen wurden übernommen.", backupPath };
  } catch (changeError) {
    if (!oldDeleted) throw new Error(`Änderung wurde vor dem Löschen abgebrochen: ${changeError.message}`);
    try {
      await runContainer(["delete", "--force", name]).catch(() => {});
      await runContainer(rollbackArgs, 600_000);
      if (wasRunning) await runContainer(["start", name]);
      throw new Error(`Die Änderung ist fehlgeschlagen; der vorherige Container wurde automatisch wiederhergestellt. Ursache: ${changeError.message}`);
    } catch (rollbackError) {
      if (/automatisch wiederhergestellt/.test(rollbackError.message)) throw rollbackError;
      throw new Error(`Änderung und automatische Wiederherstellung sind fehlgeschlagen. Die Sicherung liegt unter ${backupPath}. Ursache: ${rollbackError.message}`);
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
  if (res.czLanguage === "en" && body && typeof body === "object") {
    body = { ...body };
    if (typeof body.error === "string") body.error = englishMessage(body.error);
    if (typeof body.message === "string") body.message = englishMessage(body.message);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 524_288) throw new Error("Anfrage ist zu groß.");
  }
  return JSON.parse(raw || "{}");
}

async function handleApi(req, res, pathname) {
  try {
    const snapshotMatch = pathname.match(/^\/api\/(?:system\/logs|containers\/([^/]+)\/logs)\/snapshot$/);
    if (req.method === "GET" && snapshotMatch) {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const url = new URL(req.url, "https://localhost");
      const { tail, boot } = safeLogOptions({ tail: url.searchParams.get("tail") || 200, boot: url.searchParams.get("boot") === "1" });
      const name = snapshotMatch[1] ? decodeURIComponent(snapshotMatch[1]) : "";
      if (name && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) throw new Error("Invalid container ID.");
      const output = await runContainerOnce(name ? ["logs", "-n", String(tail), ...(boot ? ["--boot"] : []), name] : ["system", "logs", "--last", "5m"], 30_000);
      return json(res, 200, { output: output.slice(-500_000) });
    }
    if (req.method === "GET" && pathname === "/api/auth/session") {
      const session = currentSession(req);
      return json(res, 200, session
        ? { authenticated: true, username: session.username, displayName: session.displayName, expiresAt: session.expiresAt }
        : { authenticated: false });
    }
    if (req.method === "GET" && pathname === "/api/status") {
      const settings = await readSettings();
      return json(res, 200, { protocol: "HTTPS", listenHost: settings.listenHost, certificateSource: activeTls.status.source, containerCli });
    }
    if (req.method === "GET" && pathname === "/api/system/overview") {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const [version, status, diskUsage, builder, registries, stats] = await Promise.allSettled([
        runContainerOnce(["--version"], 10_000),
        runContainerOnce(["system", "status"], 20_000),
        runContainerOnce(["system", "df"], 30_000),
        runContainerOnce(builderActionArgs("status"), 20_000),
        runContainerOnce(["registry", "list", "--format", "json"], 20_000),
        runContainerOnce(["stats", "--no-stream", "--format", "json"], 20_000),
      ]);
      const settled = (result) => result.status === "fulfilled" ? { output: result.value, error: "" } : { output: "", error: result.reason.message };
      return json(res, 200, {
        cliPath: containerCli,
        cliAvailable: existsSync(containerCli),
        version: settled(version), status: settled(status), diskUsage: settled(diskUsage), builder: settled(builder), stats: settled(stats),
        registries: registries.status === "fulfilled" ? parseRegistryList(registries.value) : [],
        registriesError: registries.status === "rejected" ? registries.reason.message : "",
      });
    }
    if (req.method === "POST" && pathname === "/api/system/action") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Systemaktionen sind nur von der lokalen Oberfläche erlaubt." });
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const action = String((await readBody(req)).action || "");
      if (!["start", "stop"].includes(action)) return json(res, 400, { error: "Unbekannte Systemaktion." });
      systemStoppedByUser = action === "stop";
      const output = await runContainerOnce(["system", action], 120_000);
      return json(res, 200, { ok: true, message: action === "start" ? "Apple-Container-System wurde gestartet." : "Apple-Container-System wurde gestoppt.", output });
    }
    if (req.method === "GET" && pathname === "/api/system/logs/stream") {
      const url = new URL(req.url, `https://${req.headers.host || "127.0.0.1"}`);
      return streamContainerLogs(req, res, "", { tail: url.searchParams.get("tail") || 200 }, true);
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
        "Set-Cookie": `${sessionCookieName}=${token}; ${sessionCookieAttributes}; Max-Age=${sessionDurationMs / 1000}`,
      });
    }
    if (req.method === "POST" && pathname === "/api/auth/logout") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Abmeldung ist nur von der lokalen Oberfläche erlaubt." });
      const token = cookies(req)[sessionCookieName];
      if (token) sessions.delete(token);
      return json(res, 200, { authenticated: false }, { "Set-Cookie": `${sessionCookieName}=; ${sessionCookieAttributes}; Max-Age=0` });
    }
    if (req.method === "GET" && pathname === "/api/containers") {
      const { containers } = await currentState();
      return json(res, 200, { containers, refreshedAt: new Date().toISOString() });
    }
    if (req.method === "GET" && pathname === "/api/services/launchd") {
      const services = await listLaunchdServices({ runProcess });
      return json(res, 200, { services, refreshedAt: new Date().toISOString() });
    }
    if (req.method === "POST" && pathname === "/api/services/launchd") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "LaunchD-Dienste dürfen nur von der lokalen Oberfläche erstellt werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      return json(res, 201, { ok: true, ...(await createLaunchdService(await readBody(req), runProcess)) });
    }
    const launchdEditMatch = pathname.match(/^\/api\/services\/launchd\/([^/]+)$/);
    if (req.method === "PUT" && launchdEditMatch) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "LaunchD-Dienste dürfen nur von der lokalen Oberfläche bearbeitet werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const services = await listLaunchdServices({ runProcess });
      const service = findLaunchdService(services, decodeURIComponent(launchdEditMatch[1]));
      if (!service) return json(res, 404, { error: "LaunchD-Dienst ist nicht mehr vorhanden. Bitte Liste aktualisieren." });
      return json(res, 200, { ok: true, ...(await updateLaunchdService(service, await readBody(req), runProcess)) });
    }
    const launchdMatch = pathname.match(/^\/api\/services\/launchd\/([^/]+)\/(start|stop|restart|cleanup)$/);
    if (req.method === "POST" && launchdMatch) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "LaunchD-Dienste dürfen nur von der lokalen Oberfläche verwaltet werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const id = decodeURIComponent(launchdMatch[1]);
      const services = await listLaunchdServices({ runProcess });
      const service = findLaunchdService(services, id);
      if (!service) return json(res, 404, { error: "LaunchD-Dienst ist nicht mehr vorhanden. Bitte Liste aktualisieren." });
      if (launchdMatch[2] === "cleanup") return json(res, 200, { ok: true, ...(await cleanupLaunchdService(service, runProcess)) });
      const message = await executeLaunchdAction(service, launchdMatch[2], runProcess);
      return json(res, 200, { ok: true, message });
    }
    if (pathname === "/api/administration/settings" && ["GET", "POST"].includes(req.method)) {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      if (req.method === "GET") return json(res, 200, { ...(await readSettings()), ...(await autostartStatus()) });
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Einstellungen dürfen nur von der lokalen Oberfläche geändert werden." });
      const body = await readBody(req);
      let settings = await readSettings();
      if (body.volumeBasePath !== undefined) settings = await setVolumeBasePath(body.volumeBasePath);
      let changedListenHost = null;
      if (body.listenHost !== undefined) {
        if (!["127.0.0.1", "0.0.0.0"].includes(body.listenHost)) return json(res, 400, { error: "Ungültige Einstellung für den Netzwerkzugriff." });
        changedListenHost = body.listenHost !== settings.listenHost ? body.listenHost : null;
        settings = { ...settings, listenHost: body.listenHost };
        await saveSettings(settings);
      }
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean") return json(res, 400, { error: "Ungültige Autostart-Einstellung." });
        const current = await autostartStatus();
        if (current.enabled !== body.enabled || (body.enabled && !current.configuredForCurrentInstallation)) await setAutostart(body.enabled);
      }
      json(res, 200, { ...settings, ...(await autostartStatus()) });
      if (changedListenHost) scheduleListenHost(changedListenHost);
      return;
    }
    if (req.method === "POST" && pathname === "/api/administration/select-volume-path") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Der Ordnerdialog darf nur von der lokalen Oberfläche geöffnet werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const body = await readBody(req);
      return json(res, 200, await selectVolumeBasePath(body.language));
    }
    if (pathname === "/api/administration/certificate" && ["GET", "POST", "DELETE"].includes(req.method)) {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      if (req.method === "GET") return json(res, 200, { certificate: activeTls.status });
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Einstellungen dürfen nur von der lokalen Oberfläche geändert werden." });
      if (req.method === "DELETE") {
        activeTls = await removeCustomCertificate(appPaths.base);
      } else {
        const body = await readBody(req);
        activeTls = await installCustomCertificate(appPaths.base, body.certificate, body.privateKey);
      }
      server.setSecureContext({ cert: activeTls.cert, key: activeTls.key, minVersion: "TLSv1.2" });
      return json(res, 200, { certificate: activeTls.status });
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
    if (req.method === "GET" && pathname === "/api/images") {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      return json(res, 200, { images: await imageNames() });
    }
    if (req.method === "GET" && pathname === "/api/images/details") {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      return json(res, 200, { images: parseImages(await runContainer(["image", "list", "--format", "json"])) });
    }
    if (req.method === "GET" && pathname === "/api/operations") {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      return json(res, 200, { operations: operationStore.list() });
    }
    if (req.method === "POST" && pathname === "/api/operations") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Operationen sind nur von der lokalen Oberfläche erlaubt." });
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const body = await readBody(req);
      let args;
      let input = "";
      let label = "";
      let cleanup = async () => {};
      if (["image.pull", "image.push", "image.delete", "image.inspect"].includes(body.kind)) {
        const action = body.kind.split(".")[1];
        args = imageActionArgs(action, body);
        if (action === "delete" && body.confirmation !== body.reference) throw new Error("Image deletion requires the exact reference as confirmation.");
        label = `${action}: ${body.reference}`;
      } else if (body.kind === "image.tag") {
        args = imageActionArgs("tag", body);
        label = `tag: ${body.source} → ${body.target}`;
      } else if (body.kind === "image.build") {
        args = buildImageArgs(body);
        const contextInfo = await stat(args.at(-1));
        if (!contextInfo.isDirectory()) return json(res, 400, { error: "Build-Kontext muss ein Ordner sein." });
        if (body.dockerfileContent !== undefined) {
          if (typeof body.dockerfileContent !== "string" || !body.dockerfileContent.trim() || Buffer.byteLength(body.dockerfileContent) > 200_000) throw new Error("Invalid Dockerfile content.");
          const buildsPath = join(appPaths.base, "builds");
          await mkdir(buildsPath, { recursive: true, mode: 0o700 });
          const jobPath = await mkdtemp(join(buildsPath, "job-"));
          const file = join(jobPath, "Dockerfile");
          cleanup = () => rm(jobPath, { recursive: true, force: true });
          try { await writeFile(file, body.dockerfileContent, { mode: 0o600 }); } catch (error) { await cleanup(); throw error; }
          args.splice(1, 0, "--file", file);
        }
        label = `build: ${body.tag}`;
      } else if (["registry.login", "registry.logout"].includes(body.kind)) {
        const action = body.kind.split(".")[1];
        const command = registryAction(action, body);
        args = command.args;
        input = command.input;
        body.password = "";
        label = `${action}: ${body.host}`;
      } else {
        return json(res, 400, { error: "Unbekannte Operation." });
      }
      try {
        return json(res, 202, { operation: await operationStore.start(body.kind, label, args, { input, cleanup }) });
      } catch (error) { await cleanup(); throw error; }
    }
    if (req.method === "POST" && pathname === "/api/builder/action") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Builder-Aktionen sind nur von der lokalen Oberfläche erlaubt." });
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const body = await readBody(req);
      const action = String(body.action || "");
      return json(res, 202, { operation: await operationStore.start(`builder.${action}`, `builder: ${action}`, builderActionArgs(action, body)) });
    }
    const imageInspectMatch = pathname.match(/^\/api\/images\/inspect$/);
    if (req.method === "POST" && imageInspectMatch) {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const body = await readBody(req);
      const output = await runContainer(imageActionArgs("inspect", body));
      let inspection = output;
      try { inspection = JSON.parse(output); } catch {}
      return json(res, 200, { inspection });
    }
    if (req.method === "GET" && pathname === "/api/images/search") {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const url = new URL(req.url, `https://${req.headers.host || "127.0.0.1"}`);
      return json(res, 200, { results: await searchImages(url.searchParams.get("q")) });
    }
    if (req.method === "POST" && pathname === "/api/containers") {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Container dürfen nur von der lokalen Oberfläche erstellt werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      return json(res, 201, { ok: true, ...(await createContainer(await readBody(req))) });
    }
    const consoleMatch = pathname.match(/^\/api\/containers\/([^/]+)\/console$/);
    if (req.method === "POST" && consoleMatch) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Verwaltungsaktionen sind nur von der lokalen Oberfläche erlaubt." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(consoleMatch[1]);
      const body = await readBody(req);
      if (body.name !== name) return json(res, 400, { error: "Containername stimmt nicht überein." });
      return json(res, 200, { ok: true, ...(await openContainerConsole(name)) });
    }
    const logsMatch = pathname.match(/^\/api\/containers\/([^/]+)\/logs$/);
    if (req.method === "POST" && logsMatch) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Verwaltungsaktionen sind nur von der lokalen Oberfläche erlaubt." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(logsMatch[1]);
      const body = await readBody(req);
      if (body.name !== name) return json(res, 400, { error: "Containername stimmt nicht überein." });
      return json(res, 200, { ok: true, ...(await openContainerLogs(name)) });
    }
    const logStreamMatch = pathname.match(/^\/api\/containers\/([^/]+)\/logs\/stream$/);
    if (req.method === "GET" && logStreamMatch) {
      const url = new URL(req.url, `https://${req.headers.host || "127.0.0.1"}`);
      return streamContainerLogs(req, res, decodeURIComponent(logStreamMatch[1]), { tail: url.searchParams.get("tail"), boot: url.searchParams.get("boot") === "1" });
    }
    const inspectMatch = pathname.match(/^\/api\/containers\/([^/]+)\/inspect$/);
    if (req.method === "GET" && inspectMatch) {
      if (!currentSession(req)) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(inspectMatch[1]);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name)) throw new Error("Invalid container ID.");
      const output = await runContainer(["inspect", name]);
      let inspection = output;
      try { inspection = JSON.parse(output); } catch {}
      return json(res, 200, { inspection });
    }
    const settingsMatch = pathname.match(/^\/api\/containers\/([^/]+)\/settings$/);
    if (settingsMatch && ["GET", "PUT"].includes(req.method)) {
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(settingsMatch[1]);
      if (req.method === "GET") return json(res, 200, { settings: await containerSettings(name) });
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Container-Einstellungen dürfen nur von der lokalen Oberfläche geändert werden." });
      return json(res, 200, { ok: true, ...(await updateContainerSettings(name, await readBody(req))) });
    }
    const deleteMatch = pathname.match(/^\/api\/containers\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      if (!requireLocalOrigin(req)) return json(res, 403, { error: "Container dürfen nur von der lokalen Oberfläche gelöscht werden." });
      const session = currentSession(req);
      if (!session) return json(res, 401, { error: "Bitte als macOS-Administrator anmelden." });
      const name = decodeURIComponent(deleteMatch[1]);
      return json(res, 200, { ok: true, ...(await deleteContainer(name, await readBody(req))) });
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

async function handleMcp(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Allow": "POST", "Cache-Control": "no-store" });
    return res.end();
  }
  if (!validMcpToken(mcpToken)) {
    return json(res, 503, { error: "Remote MCP is disabled. Configure APFEL_HAFEN_MCP_TOKEN with a token of at least 32 non-whitespace characters." });
  }
  if (!mcpBearerAuthorized(req.headers.authorization, mcpToken)) {
    return json(res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": 'Bearer realm="apfel-hafen-mcp"' });
  }
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return json(res, 415, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Content-Type must be application/json." } });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    return json(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  if (!Array.isArray(payload)) {
    const headerError = validateModernMcpHeaders(req.headers, payload);
    if (headerError) return json(res, 400, { jsonrpc: "2.0", id: payload?.id ?? null, error: { code: -32020, message: "HeaderMismatch", data: headerError } });
  }
  const protocolVersion = String(req.headers["mcp-protocol-version"] || "");
  const reply = await dispatchMcpPayload(payload, invokeMcpTool, { protocolVersion });
  if (!reply) {
    res.writeHead(202, { "Cache-Control": "no-store" });
    return res.end();
  }
  return json(res, 200, reply, { "MCP-Protocol-Version": protocolVersion === currentMcpProtocolVersion ? currentMcpProtocolVersion : "2025-11-25" });
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

let activeTls = await loadTlsCertificate(appPaths.base);
const server = createServer(activeTls, async (req, res) => {
  res.czLanguage = requestLanguage(req);
  const url = new URL(req.url, `https://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname === "/mcp") return handleMcp(req, res);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
  if (isDev) return json(res, 404, { error: "Frontend läuft im Entwicklungsmodus auf Port 5173." });
  return serveStatic(req, res, url.pathname);
});

let activeListenHost = localListenHost;
let rebindTimer;

function listen(host) {
  activeListenHost = normalizeListenHost(host);
  server.listen(port, activeListenHost, () => console.log(`Apfel-Hafen: https://${activeListenHost}:${port}`));
}

function scheduleListenHost(host) {
  const nextHost = normalizeListenHost(host);
  if (nextHost === activeListenHost) return;
  clearTimeout(rebindTimer);
  rebindTimer = setTimeout(() => {
    server.close(() => listen(nextHost));
    server.closeIdleConnections?.();
  }, 300);
}

listen((await readSettings()).listenHost);

if (!validMcpToken(mcpToken)) console.log(`Apfel-Hafen: Remote MCP is disabled; set APFEL_HAFEN_MCP_TOKEN or create ${mcpTokenPath}.`);
