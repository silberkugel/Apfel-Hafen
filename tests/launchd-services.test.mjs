import test from "node:test";
import assert from "node:assert/strict";
import { cleanupLaunchdService, createLaunchdService, executeLaunchdAction, launchAgentPlistFromDraft, launchdDomain, normalizeLaunchdService, parseLaunchctlStatus, validateLaunchdDraft } from "../lib/launchd-services.mjs";

test("parses launchctl state without mistaking an exited job for running", () => {
  assert.deepEqual(parseLaunchctlStatus("state = running\n\tpid = 481\n\tlast exit code = 0"), { loaded: true, state: "running", running: true, pid: 481, lastExitStatus: 0 });
  assert.deepEqual(parseLaunchctlStatus("state = exited\n\tlast exit code = 78"), { loaded: true, state: "exited", running: false, pid: null, lastExitStatus: 78 });
});

test("normalizes plist metadata and limits management to the user scope", () => {
  const service = normalizeLaunchdService({ Label: "de.example.worker", ProgramArguments: ["/usr/bin/true", "--once"], RunAtLoad: true, KeepAlive: { SuccessfulExit: false }, StartInterval: 300, StartCalendarInterval: [{ Weekday: 1, Hour: 8, Minute: 30 }, { Weekday: 7, Hour: 17, Minute: 45 }, { Minute: 5 }] }, { scope: "user", kind: "LaunchAgent", path: "/Users/test/Library/LaunchAgents/de.example.worker.plist" });
  assert.equal(service.program, "/usr/bin/true");
  assert.equal(service.keepAlive, true);
  assert.equal(service.startInterval, 300);
  assert.deepEqual(service.calendarIntervals, [{ weekday: 1, hour: 8, minute: 30 }, { weekday: 0, hour: 17, minute: 45 }, { weekday: null, hour: null, minute: 5 }]);
  assert.equal(service.canManage, true);
  assert.equal(launchdDomain(service, 501), "gui/501");
});

test("uses bootstrap, bootout and kickstart for user agents", async () => {
  const calls = [];
  const runProcess = async (program, args) => { calls.push([program, args]); return { code: 0, stdout: "", stderr: "" }; };
  const service = { label: "de.example.worker", kind: "LaunchAgent", scope: "user", path: "/tmp/de.example.worker.plist", loaded: false, canManage: true };
  await executeLaunchdAction(service, "start", runProcess, 501);
  await executeLaunchdAction({ ...service, loaded: true }, "restart", runProcess, 501);
  await executeLaunchdAction({ ...service, loaded: true }, "stop", runProcess, 501);
  assert.deepEqual(calls.map((call) => call[1][0]), ["bootstrap", "kickstart", "bootout"]);
  assert.deepEqual(calls[1][1], ["kickstart", "-k", "gui/501/de.example.worker"]);
});

test("rejects changes to system services", async () => {
  await assert.rejects(() => executeLaunchdAction({ canManage: false }, "stop", async () => ({ code: 0 })), /benutzereigene/);
});

test("moves an orphaned user agent to Trash after unloading it", async () => {
  const calls = [];
  const moves = [];
  const service = { label: "Yaps", kind: "LaunchAgent", scope: "user", path: "/Users/test/Library/LaunchAgents/Yaps.plist", loaded: true, canCleanup: true };
  const result = await cleanupLaunchdService(service, async (program, args) => { calls.push([program, args]); return { code: 0, stderr: "" }; }, { home: "/Users/test", move: async (...args) => moves.push(args), now: () => 1234 });
  assert.deepEqual(calls[0][1], ["bootout", `gui/${process.getuid()}`, service.path]);
  assert.deepEqual(moves[0], [service.path, "/Users/test/.Trash/Yaps-1234.plist"]);
  assert.match(result.message, /Papierkorb/);
});

test("rejects cleanup outside the user LaunchAgents directory", async () => {
  await assert.rejects(() => cleanupLaunchdService({ scope: "user", canCleanup: true, path: "/tmp/Yaps.plist" }, async () => ({ code: 0 }), { home: "/Users/test" }), /nicht sicher/);
});

test("creates an escaped user LaunchAgent without overwriting files", async () => {
  const writes = [];
  const calls = [];
  const input = { label: "de.example.worker", program: "/usr/bin/true", arguments: ["--name", "A&B"], runAtLoad: true, keepAlive: false, loadNow: true };
  const result = await createLaunchdService(input, async (program, args) => { calls.push([program, args]); return { code: 0, stderr: "" }; }, { home: "/Users/test", makeDirectory: async () => {}, write: async (...args) => writes.push(args), remove: async () => {} });
  assert.equal(writes[0][0], "/Users/test/Library/LaunchAgents/de.example.worker.plist");
  assert.equal(writes[0][2].flag, "wx");
  assert.match(writes[0][1], /A&amp;B/);
  assert.deepEqual(calls[0][1], ["bootstrap", `gui/${process.getuid()}`, writes[0][0]]);
  assert.match(result.message, /erstellt und geladen/);
});

test("writes all four launchd start options to the LaunchAgent plist", () => {
  const plist = launchAgentPlistFromDraft({
    label: "de.example.scheduled",
    program: "/usr/bin/true",
    runAtLoad: true,
    keepAlive: true,
    startInterval: 900,
    calendarIntervals: [{ weekday: null, hour: 7, minute: 15 }, { weekday: 1, hour: 18, minute: 30 }],
  });

  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<key>StartInterval<\/key>\s*<integer>900<\/integer>/);
  assert.match(plist, /<key>StartCalendarInterval<\/key>\s*<array>/);
  assert.match(plist, /<key>Weekday<\/key>\s*<integer>1<\/integer>/);
  assert.match(plist, /<key>Hour<\/key>\s*<integer>18<\/integer>/);
  assert.match(plist, /<key>Minute<\/key>\s*<integer>30<\/integer>/);
});

test("validates LaunchAgent labels, paths and log paths", () => {
  assert.throws(() => validateLaunchdDraft({ label: "bad label", program: "/usr/bin/true" }), /Label/);
  assert.throws(() => validateLaunchdDraft({ label: "de.ok", program: "relative" }), /Programmpfad/);
  assert.throws(() => launchAgentPlistFromDraft({ label: "de.ok", program: "/usr/bin/true", standardOutPath: "relative.log" }), /Logpfade/);
  assert.throws(() => validateLaunchdDraft({ label: "de.ok", program: "/usr/bin/true", startInterval: 0 }), /Startintervall/);
  assert.throws(() => validateLaunchdDraft({ label: "de.ok", program: "/usr/bin/true", calendarIntervals: [{ weekday: 8, hour: 12, minute: 0 }] }), /Wochentag/);
  assert.throws(() => validateLaunchdDraft({ label: "de.ok", program: "/usr/bin/true", calendarIntervals: [{ weekday: 1, hour: 24, minute: 0 }] }), /Uhrzeit/);
});
