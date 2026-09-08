#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { launchAgentPlistFromDraft } from "../lib/launchd-services.mjs";

if (process.platform !== "darwin") {
  console.error("Der launchd-Funktionstest benötigt macOS.");
  process.exit(1);
}

const execFileAsync = promisify(execFile);
const uid = process.getuid();
const domain = `gui/${uid}`;
const workspace = await mkdtemp(join(tmpdir(), "apfel-hafen-launchd-test-"));
const launchAgentsDirectory = join(homedir(), "Library", "LaunchAgents");
const labels = [];
await mkdir(launchAgentsDirectory, { recursive: true });

async function command(program, args, { allowFailure = false } = {}) {
  try {
    return await execFileAsync(program, args);
  } catch (error) {
    if (allowFailure) return { stdout: error.stdout || "", stderr: error.stderr || error.message };
    throw new Error(`${program} ${args.join(" ")} ist fehlgeschlagen: ${error.stderr || error.message}`);
  }
}

async function lineCount(path) {
  try {
    return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function waitFor(description, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Zeitüberschreitung: ${description}`);
}

async function exercise(name, draft, expectedRuns, timeoutMs, throttleInterval = null) {
  const label = `de.apfel-hafen.test.${process.pid}.${name}`;
  const marker = join(workspace, `${name}.runs`);
  const plistPath = join(launchAgentsDirectory, `${label}.plist`);
  labels.push({ label, plistPath });
  const shellCommand = "printf '%s\\n' \"$$\" >> \"$1\"";
  await writeFile(plistPath, launchAgentPlistFromDraft({
    label,
    program: "/bin/sh",
    arguments: ["-c", shellCommand, "apfel-hafen-launchd-test", marker],
    ...draft,
  }));
  if (throttleInterval !== null) await command("/usr/bin/plutil", ["-insert", "ThrottleInterval", "-integer", String(throttleInterval), plistPath]);
  await command("/usr/bin/plutil", ["-lint", plistPath]);
  await command("/bin/launchctl", ["bootstrap", domain, plistPath]);
  await waitFor(`${name} wurde nicht ${expectedRuns}-mal gestartet`, async () => await lineCount(marker) >= expectedRuns, timeoutMs);
  const runs = await lineCount(marker);
  console.log(`✓ ${name}: ${runs} Start${runs === 1 ? "" : "s"}`);
  await command("/bin/launchctl", ["bootout", domain, plistPath], { allowFailure: true });
}

try {
  await exercise("RunAtLoad", { runAtLoad: true, keepAlive: false }, 1, 5_000);
  await exercise("KeepAlive", { runAtLoad: true, keepAlive: true }, 2, 15_000, 1);
  await exercise("StartInterval", { runAtLoad: false, keepAlive: false, startInterval: 2 }, 2, 15_000, 1);

  const nextMinute = new Date(Math.ceil(Date.now() / 60_000) * 60_000);
  const calendarWait = Math.max(10_000, nextMinute.getTime() - Date.now() + 10_000);
  console.log(`… StartCalendarInterval wird um ${String(nextMinute.getHours()).padStart(2, "0")}:${String(nextMinute.getMinutes()).padStart(2, "0")} geprüft.`);
  await exercise("StartCalendarInterval", {
    runAtLoad: false,
    keepAlive: false,
    calendarIntervals: [{ weekday: null, hour: nextMinute.getHours(), minute: nextMinute.getMinutes() }],
  }, 1, calendarWait);
  console.log("Alle vier launchd-Startarten funktionieren.");
} finally {
  await Promise.all(labels.map(({ plistPath }) => command("/bin/launchctl", ["bootout", domain, plistPath], { allowFailure: true })));
  await Promise.all(labels.map(({ plistPath }) => rm(plistPath, { force: true })));
  await rm(workspace, { recursive: true, force: true });
}
