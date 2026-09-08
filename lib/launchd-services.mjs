import { copyFile, mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export const launchdLocations = (home = homedir()) => [
  { directory: join(home, "Library", "LaunchAgents"), scope: "user", kind: "LaunchAgent" },
  { directory: "/Library/LaunchAgents", scope: "system", kind: "LaunchAgent" },
  { directory: "/Library/LaunchDaemons", scope: "system", kind: "LaunchDaemon" },
];

export function launchdDomain(service, uid = process.getuid()) {
  if (service.kind === "LaunchDaemon") return "system";
  return `gui/${uid}`;
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function validateLaunchdDraft(input) {
  const label = String(input?.label || "").trim();
  const program = String(input?.program || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(label)) throw new Error("Das Label muss 2–128 Zeichen lang sein und darf nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich enthalten.");
  if (!program.startsWith("/") || program.length > 1000) throw new Error("Bitte einen gültigen absoluten Programmpfad angeben.");
  const argumentsList = Array.isArray(input.arguments) ? input.arguments.map((value) => String(value).trim()).filter(Boolean) : [];
  if (argumentsList.length > 64 || argumentsList.some((value) => value.length > 2000)) throw new Error("Es sind höchstens 64 Argumente mit jeweils 2.000 Zeichen erlaubt.");
  const standardOutPath = String(input.standardOutPath || "").trim();
  const standardErrorPath = String(input.standardErrorPath || "").trim();
  if ([standardOutPath, standardErrorPath].some((value) => value && (!value.startsWith("/") || value.length > 1000))) throw new Error("Logpfade müssen absolut sein.");
  const rawStartInterval = input.startInterval;
  const startInterval = rawStartInterval === undefined || rawStartInterval === null || rawStartInterval === "" ? null : Number(rawStartInterval);
  if (startInterval !== null && (!Number.isInteger(startInterval) || startInterval < 1 || startInterval > 31_536_000)) throw new Error("Das Startintervall muss zwischen 1 Sekunde und 365 Tagen liegen.");
  const rawCalendarIntervals = Array.isArray(input.calendarIntervals) ? input.calendarIntervals : [];
  if (rawCalendarIntervals.length > 32) throw new Error("Es sind höchstens 32 kalenderbasierte Startzeiten erlaubt.");
  const calendarIntervals = rawCalendarIntervals.map((entry) => {
    const weekday = entry?.weekday === undefined || entry?.weekday === null || entry?.weekday === "" ? null : Number(entry.weekday);
    const hour = Number(entry?.hour);
    const minute = Number(entry?.minute);
    if (weekday !== null && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) throw new Error("Der Wochentag der Startzeit ist ungültig.");
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error("Kalenderbasierte Startzeiten benötigen eine gültige Uhrzeit.");
    return { weekday, hour, minute };
  });
  return { label, program, arguments: argumentsList, runAtLoad: input.runAtLoad === true, keepAlive: input.keepAlive === true, startInterval, calendarIntervals, loadNow: input.loadNow !== false, standardOutPath, standardErrorPath };
}

export function launchAgentPlistFromDraft(input) {
  const draft = validateLaunchdDraft(input);
  const args = [draft.program, ...draft.arguments].map((value) => `      <string>${xmlEscape(value)}</string>`).join("\n");
  const calendarInterval = (entry) => [
    "      <dict>",
    ...(entry.weekday === null ? [] : ["        <key>Weekday</key>", `        <integer>${entry.weekday}</integer>`]),
    "        <key>Hour</key>",
    `        <integer>${entry.hour}</integer>`,
    "        <key>Minute</key>",
    `        <integer>${entry.minute}</integer>`,
    "      </dict>",
  ].join("\n");
  const optional = [
    draft.startInterval === null ? "" : `    <key>StartInterval</key>\n    <integer>${draft.startInterval}</integer>`,
    draft.calendarIntervals.length ? `    <key>StartCalendarInterval</key>\n    <array>\n${draft.calendarIntervals.map(calendarInterval).join("\n")}\n    </array>` : "",
    draft.standardOutPath ? `    <key>StandardOutPath</key>\n    <string>${xmlEscape(draft.standardOutPath)}</string>` : "",
    draft.standardErrorPath ? `    <key>StandardErrorPath</key>\n    <string>${xmlEscape(draft.standardErrorPath)}</string>` : "",
  ].filter(Boolean).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${xmlEscape(draft.label)}</string>
    <key>ProgramArguments</key>
    <array>
${args}
    </array>
    <key>RunAtLoad</key>
    <${draft.runAtLoad}/>
    <key>KeepAlive</key>
    <${draft.keepAlive}/>
${optional}
  </dict>
</plist>
`;
}

export async function createLaunchdService(input, runProcess, { home = homedir(), makeDirectory = mkdir, write = writeFile, remove = unlink } = {}) {
  const draft = validateLaunchdDraft(input);
  if (!existsSync(draft.program)) throw new Error("Die ausgewählte Programmdatei wurde nicht gefunden.");
  const directory = join(home, "Library", "LaunchAgents");
  const path = join(directory, `${draft.label}.plist`);
  await makeDirectory(directory, { recursive: true });
  try {
    await write(path, launchAgentPlistFromDraft(draft), { encoding: "utf8", mode: 0o644, flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Ein LaunchAgent mit diesem Label ist bereits vorhanden.");
    throw error;
  }
  if (draft.loadNow) {
    const result = await runProcess("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, path]);
    if (result.code !== 0) {
      await remove(path).catch(() => {});
      throw new Error(result.stderr || "Der LaunchAgent konnte nicht geladen werden.");
    }
  }
  return { message: draft.loadNow ? "LaunchAgent wurde erstellt und geladen." : "LaunchAgent wurde erstellt.", path };
}

async function replacePlistValue(path, key, type, value, runProcess) {
  const serialized = type === "json" ? JSON.stringify(value) : String(value);
  let result = await runProcess("/usr/bin/plutil", ["-replace", key, `-${type}`, serialized, path]);
  if (result.code !== 0) result = await runProcess("/usr/bin/plutil", ["-insert", key, `-${type}`, serialized, path]);
  if (result.code !== 0) throw new Error(result.stderr || `Der Plist-Wert „${key}“ konnte nicht aktualisiert werden.`);
}

async function removePlistValue(path, key, runProcess) {
  await runProcess("/usr/bin/plutil", ["-remove", key, path]);
}

export async function updateLaunchdService(service, input, runProcess, {
  home = homedir(), copy = copyFile, move = rename, remove = unlink, uniqueId = randomUUID,
} = {}) {
  if (!service?.canManage || service.canEdit === false || service.scope !== "user" || service.kind !== "LaunchAgent") throw new Error("Dieser LaunchAgent enthält Startregeln, die nicht verlustfrei bearbeitet werden können.");
  const expectedDirectory = join(home, "Library", "LaunchAgents");
  if (dirname(service.path) !== expectedDirectory || basename(service.path) !== `${service.label}.plist`) throw new Error("Der LaunchAgent-Pfad ist nicht sicher.");
  const draft = validateLaunchdDraft({ ...input, label: service.label, loadNow: false });
  const suffix = uniqueId();
  const temporaryPath = join(expectedDirectory, `.${service.label}.${suffix}.plist`);
  const backupPath = join(expectedDirectory, `.${service.label}.${suffix}.backup.plist`);
  const replacedPath = join(expectedDirectory, `.${service.label}.${suffix}.replaced.plist`);
  const domain = launchdDomain(service);
  let unloaded = false;
  let backupCreated = false;
  let installed = false;
  let failure;

  try {
    await copy(service.path, temporaryPath);
    await removePlistValue(temporaryPath, "Program", runProcess);
    await replacePlistValue(temporaryPath, "ProgramArguments", "json", [draft.program, ...draft.arguments], runProcess);
    await replacePlistValue(temporaryPath, "RunAtLoad", "bool", draft.runAtLoad, runProcess);
    await replacePlistValue(temporaryPath, "KeepAlive", "bool", draft.keepAlive, runProcess);
    if (draft.startInterval === null) await removePlistValue(temporaryPath, "StartInterval", runProcess);
    else await replacePlistValue(temporaryPath, "StartInterval", "integer", draft.startInterval, runProcess);
    if (draft.calendarIntervals.length) {
      const calendarIntervals = draft.calendarIntervals.map((entry) => ({
        ...(entry.weekday === null ? {} : { Weekday: entry.weekday }), Hour: entry.hour, Minute: entry.minute,
      }));
      await replacePlistValue(temporaryPath, "StartCalendarInterval", "json", calendarIntervals, runProcess);
    } else await removePlistValue(temporaryPath, "StartCalendarInterval", runProcess);
    if (draft.standardOutPath) await replacePlistValue(temporaryPath, "StandardOutPath", "string", draft.standardOutPath, runProcess);
    else await removePlistValue(temporaryPath, "StandardOutPath", runProcess);
    if (draft.standardErrorPath) await replacePlistValue(temporaryPath, "StandardErrorPath", "string", draft.standardErrorPath, runProcess);
    else await removePlistValue(temporaryPath, "StandardErrorPath", runProcess);
    const lint = await runProcess("/usr/bin/plutil", ["-lint", temporaryPath]);
    if (lint.code !== 0) throw new Error(lint.stderr || "Die aktualisierte LaunchAgent-Datei ist ungültig.");

    if (service.loaded) {
      const result = await runProcess("/bin/launchctl", ["bootout", domain, service.path]);
      if (result.code !== 0) throw new Error(result.stderr || "Der LaunchAgent konnte vor der Änderung nicht entladen werden.");
      unloaded = true;
    }
    await move(service.path, backupPath);
    backupCreated = true;
    await move(temporaryPath, service.path);
    installed = true;
    if (service.loaded) {
      const result = await runProcess("/bin/launchctl", ["bootstrap", domain, service.path]);
      if (result.code !== 0) throw new Error(result.stderr || "Der bearbeitete LaunchAgent konnte nicht geladen werden.");
      unloaded = false;
    }
    await remove(backupPath).catch(() => {});
    backupCreated = false;
    return { message: "LaunchAgent wurde aktualisiert.", path: service.path };
  } catch (error) {
    failure = error;
    const rollbackErrors = [];
    if (installed) {
      try {
        await move(service.path, replacedPath);
        installed = false;
      } catch (rollbackError) {
        rollbackErrors.push(`Die neue Konfiguration konnte nicht gesichert werden: ${rollbackError.message}`);
      }
    }
    if (backupCreated) {
      try {
        await move(backupPath, service.path);
        backupCreated = false;
      } catch (rollbackError) {
        rollbackErrors.push(`Die vorherige Konfiguration liegt weiterhin unter ${backupPath}: ${rollbackError.message}`);
      }
    }
    if (unloaded && !backupCreated) {
      const rollback = await runProcess("/bin/launchctl", ["bootstrap", domain, service.path]);
      if (rollback.code !== 0) failure = new Error(`${error.message} Die vorherige Konfiguration konnte nicht wieder geladen werden: ${rollback.stderr || "unbekannter Fehler"}`);
    }
    if (rollbackErrors.length) failure = new Error(`${failure.message} ${rollbackErrors.join(" ")}`);
    throw failure;
  } finally {
    const cleanupPaths = [temporaryPath, replacedPath, ...(backupCreated ? [] : [backupPath])];
    await Promise.all(cleanupPaths.map((path) => remove(path).catch(() => {})));
  }
}

export function parseLaunchctlStatus(output) {
  const state = output.match(/^\s*state\s*=\s*(.+)$/m)?.[1]?.trim() || "unknown";
  const pid = Number(output.match(/^\s*pid\s*=\s*(\d+)$/m)?.[1] || 0) || null;
  const lastExitStatus = Number(output.match(/^\s*last exit code\s*=\s*(-?\d+)$/m)?.[1] ?? NaN);
  return {
    loaded: true,
    state,
    running: state === "running" || pid !== null,
    pid,
    lastExitStatus: Number.isFinite(lastExitStatus) ? lastExitStatus : null,
  };
}

export function normalizeLaunchdService(plist, metadata, status = { loaded: false, state: "unloaded", running: false, pid: null, lastExitStatus: null }) {
  const programArguments = Array.isArray(plist.ProgramArguments) ? plist.ProgramArguments.map(String) : [];
  const program = String(plist.Program || programArguments[0] || "");
  const orphaned = program.startsWith("/") && !existsSync(program);
  const rawCalendarIntervals = Array.isArray(plist.StartCalendarInterval)
    ? plist.StartCalendarInterval
    : plist.StartCalendarInterval && typeof plist.StartCalendarInterval === "object" ? [plist.StartCalendarInterval] : [];
  const calendarIntervals = rawCalendarIntervals.map((entry) => {
    const calendarNumber = (value) => value === undefined || value === null ? null : Number(value);
    const rawWeekday = calendarNumber(entry.Weekday);
    const hour = calendarNumber(entry.Hour);
    const minute = calendarNumber(entry.Minute);
    return {
      weekday: Number.isInteger(rawWeekday) ? (rawWeekday === 7 ? 0 : rawWeekday) : null,
      hour: Number.isInteger(hour) ? hour : null,
      minute: Number.isInteger(minute) ? minute : null,
    };
  });
  const keepAliveEditable = plist.KeepAlive === undefined || typeof plist.KeepAlive === "boolean";
  const calendarIntervalsEditable = rawCalendarIntervals.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    if (Object.keys(entry).some((key) => !new Set(["Weekday", "Hour", "Minute"]).has(key))) return false;
    const weekday = entry.Weekday === undefined ? null : Number(entry.Weekday);
    return (weekday === null || (Number.isInteger(weekday) && weekday >= 0 && weekday <= 7))
      && Number.isInteger(Number(entry.Hour)) && Number(entry.Hour) >= 0 && Number(entry.Hour) <= 23
      && Number.isInteger(Number(entry.Minute)) && Number(entry.Minute) >= 0 && Number(entry.Minute) <= 59;
  });
  const canManage = metadata.scope === "user";
  return {
    id: `${metadata.scope}:${metadata.kind}:${plist.Label}`,
    label: String(plist.Label),
    kind: metadata.kind,
    scope: metadata.scope,
    path: metadata.path,
    program,
    programArguments,
    runAtLoad: plist.RunAtLoad === true,
    keepAlive: plist.KeepAlive === true || (plist.KeepAlive && typeof plist.KeepAlive === "object"),
    startInterval: Number(plist.StartInterval) || null,
    calendarIntervals,
    standardOutPath: String(plist.StandardOutPath || ""),
    standardErrorPath: String(plist.StandardErrorPath || ""),
    ...status,
    canManage,
    canEdit: canManage && keepAliveEditable && calendarIntervalsEditable,
    orphaned,
    canCleanup: metadata.scope === "user" && orphaned,
  };
}

async function plistFiles(location) {
  try {
    return (await readdir(location.directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".plist"))
      .map((entry) => ({ ...location, path: join(location.directory, entry.name) }));
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EACCES") return [];
    throw error;
  }
}

export async function listLaunchdServices({ runProcess, locations = launchdLocations(), uid = process.getuid() }) {
  const files = (await Promise.all(locations.map(plistFiles))).flat();
  const services = await Promise.all(files.map(async (metadata) => {
    try {
      const converted = await runProcess("/usr/bin/plutil", ["-convert", "json", "-o", "-", metadata.path]);
      if (converted.code !== 0) return null;
      const plist = JSON.parse(converted.stdout);
      if (!plist.Label) return null;
      const domain = launchdDomain(metadata, uid);
      const result = await runProcess("/bin/launchctl", ["print", `${domain}/${plist.Label}`]);
      const status = result.code === 0
        ? parseLaunchctlStatus(result.stdout)
        : { loaded: false, state: "unloaded", running: false, pid: null, lastExitStatus: null };
      return normalizeLaunchdService(plist, metadata, status);
    } catch {
      return null;
    }
  }));
  return services.filter(Boolean).sort((a, b) => a.label.localeCompare(b.label));
}

export function findLaunchdService(services, id) {
  return services.find((service) => service.id === id) || null;
}

export async function executeLaunchdAction(service, action, runProcess, uid = process.getuid()) {
  if (!service?.canManage) throw new Error("Nur benutzereigene LaunchAgents können in dieser Version verwaltet werden.");
  if (!new Set(["start", "stop", "restart"]).has(action)) throw new Error("Unbekannte LaunchD-Aktion.");
  const target = `${launchdDomain(service, uid)}/${service.label}`;
  let result;
  if (action === "stop") {
    result = await runProcess("/bin/launchctl", ["bootout", launchdDomain(service, uid), service.path]);
  } else if (action === "start" && !service.loaded) {
    result = await runProcess("/bin/launchctl", ["bootstrap", launchdDomain(service, uid), service.path]);
  } else {
    result = await runProcess("/bin/launchctl", ["kickstart", ...(action === "restart" ? ["-k"] : []), target]);
  }
  if (result.code !== 0) throw new Error(result.stderr || `LaunchD-Aktion „${action}“ ist fehlgeschlagen.`);
  return action === "stop" ? "LaunchAgent wurde entladen." : action === "restart" ? "LaunchAgent wurde neu gestartet." : "LaunchAgent wurde gestartet.";
}

export async function cleanupLaunchdService(service, runProcess, { home = homedir(), move = rename, now = Date.now } = {}) {
  if (!service?.canCleanup || service.scope !== "user") throw new Error("Nur verwaiste benutzereigene LaunchAgents können bereinigt werden.");
  const expectedDirectory = join(home, "Library", "LaunchAgents");
  if (!service.path.startsWith(`${expectedDirectory}/`) || !service.path.endsWith(".plist")) throw new Error("Der LaunchAgent-Pfad ist nicht sicher.");
  const domain = launchdDomain(service);
  if (service.loaded) {
    const result = await runProcess("/bin/launchctl", ["bootout", domain, service.path]);
    if (result.code !== 0 && !/could not find|no such process|not found/i.test(result.stderr)) {
      throw new Error(result.stderr || "Der verwaiste LaunchAgent konnte nicht entladen werden.");
    }
  }
  const trashName = `${basename(service.path, ".plist")}-${now()}.plist`;
  const trashPath = join(home, ".Trash", trashName);
  try {
    await move(service.path, trashPath);
  } catch (error) {
    if (service.loaded) await runProcess("/bin/launchctl", ["bootstrap", domain, service.path]);
    throw new Error(`Die LaunchAgent-Datei konnte nicht in den Papierkorb verschoben werden: ${error.message}`);
  }
  return { message: "Verwaister LaunchAgent wurde in den Papierkorb verschoben.", trashPath };
}
