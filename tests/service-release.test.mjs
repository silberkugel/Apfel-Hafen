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

test("administrator can open a container console and inspect startup logs", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(server, /consoleMatch = pathname\.match/);
  assert.match(server, /consoleCommands = \["sh", "bash", "ash", "python3", "python"\]/);
  assert.match(server, /exec --interactive --tty/);
  assert.match(server, /tell application "Terminal" to do script/);
  assert.match(client, /openContainerConsole/);
  assert.match(client, /t\("console"\)/);
  assert.match(server, /logsMatch = pathname\.match/);
  assert.match(server, /\["logs", "--boot", name\]/);
  assert.match(server, /\["logs", "-n", "200", name\]/);
  assert.match(client, /openContainerLogs/);
  assert.match(client, /t\("containerLogsLabel"\)/);
  assert.match(client, /className="log-sections"/);
  assert.match(client, /containerLogs\.bootLog/);
  assert.match(client, /containerLogs\.outputLog/);
});

test("failed first starts remain inspectable and MQTT gets useful defaults", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(server, /Er bleibt für die Fehlersuche erhalten/);
  assert.doesNotMatch(server, /catch \(error\) \{\s*await runContainer\(\["delete", "--force", draft\.name\]/);
  assert.match(client, /mosquitto\|mqtt/);
  assert.match(client, /containerPort = 1883/);
  assert.match(client, /destination = "\/mosquitto\/data"/);
});

test("successful container replacement clears the checked update state", async () => {
  const client = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(client, /if \(action === "replace"\) \{\s*setUpdates/);
  assert.match(client, /delete next\[container\.name\]/);
});

test("Hermes images receive safe gateway defaults", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /nousresearch\\\/hermes-agent/);
  assert.match(source, /containerPort = 8642/);
  assert.match(source, /destination = "\/opt\/data"/);
  assert.match(source, /\["gateway", "run"\]/);
});

test("native app bundle uses SMAppService without an embedded browser", async () => {
  const service = await readFile(new URL("../MacApp/Sources/ApfelHafen/Services/ServiceManager.swift", import.meta.url), "utf8");
  const app = await readFile(new URL("../MacApp/Sources/ApfelHafen/App/ApfelHafenApp.swift", import.meta.url), "utf8");
  const plist = await readFile(new URL("../MacApp/Resources/de.apfel-hafen.service.plist", import.meta.url), "utf8");
  assert.match(service, /SMAppService\.agent/);
  assert.match(plist, /<key>BundleProgram<\/key>/);
  assert.doesNotMatch(app, /WKWebView|WebKit/);
});

test("LaunchAgent creation exposes all four launchd start options", async () => {
  const client = await readFile(new URL("../src/LaunchdScheduleOptions.jsx", import.meta.url), "utf8");

  assert.match(client, /runAtLoad/);
  assert.match(client, /keepAlive/);
  assert.match(client, /startInterval/);
  assert.match(client, /calendarIntervals/);
  assert.match(client, /function LaunchdScheduleOptions/);
});

test("existing user LaunchAgents can be edited through the protected API", async () => {
  const [server, client] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /req\.method === "PUT" && launchdEditMatch/);
  assert.match(server, /updateLaunchdService/);
  assert.match(client, /method: serviceEditing \? "PUT" : "POST"/);
  assert.match(client, /launchdDraftFromService/);
});

test("release 0.2.8 metadata and artifact names stay aligned", async () => {
  const [packageSource, readmeDe, readmeEn, releaseNotes] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README-DE.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../RELEASE-NOTES-0.2.8.md", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(packageSource).version, "0.2.8");
  assert.match(readmeDe, /Apfel-Hafen-0\.2\.8-macos-arm64\.zip/);
  assert.match(readmeEn, /Apfel-Hafen-0\.2\.8-macos-arm64\.dmg/);
  assert.match(releaseNotes, /^# Apfel-Hafen 0\.2\.8$/m);
});
