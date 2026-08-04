import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchAgentPlist } from "./lib/autostart.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const label = "de.apfel-hafen.service";
const domain = `gui/${process.getuid()}`;
const target = `${domain}/${label}`;
const launchAgentPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logDir = join(homedir(), "Library", "Logs", "Apfel-Hafen");
const bundledNode = join(root, "runtime", "node");
const nodePath = existsSync(bundledNode) ? bundledNode : process.execPath;
const serverPath = join(root, "server.mjs");

function launchctl(args, { allowFailure = false } = {}) {
  const result = spawnSync("/bin/launchctl", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `launchctl ${args[0]} failed`).trim());
  }
  return result;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function install() {
  if (!existsSync(serverPath)) throw new Error(`Server fehlt: ${serverPath}`);
  if (!existsSync(join(root, "dist", "index.html"))) throw new Error("Die gebaute Weboberfläche fehlt.");

  await mkdir(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  await mkdir(logDir, { recursive: true });
  const plist = launchAgentPlist({
    label,
    nodePath,
    serverPath,
    stdoutPath: join(logDir, "service.log"),
    stderrPath: join(logDir, "service-error.log"),
  });
  await writeFile(launchAgentPath, plist, { mode: 0o644 });
  await chmod(launchAgentPath, 0o644);
  launchctl(["enable", target]);
}

async function start() {
  await install();

  // Reloading also replaces a service definition left behind by an older
  // installation directory. A missing loaded job is harmless here.
  launchctl(["bootout", target], { allowFailure: true });
  await wait(250);
  let bootstrapResult;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    bootstrapResult = launchctl(["bootstrap", domain, launchAgentPath], { allowFailure: true });
    if (bootstrapResult.status === 0) break;
    await wait(250);
  }
  if (bootstrapResult.status !== 0) {
    throw new Error((bootstrapResult.stderr || bootstrapResult.stdout || "LaunchAgent konnte nicht geladen werden.").trim());
  }
  launchctl(["kickstart", target]);
  process.stdout.write(`Apfel-Hafen wurde als Hintergrunddienst gestartet.\n${launchAgentPath}\n`);
}

function stop() {
  const result = launchctl(["bootout", target], { allowFailure: true });
  if (result.status !== 0 && !/Could not find service|No such process/i.test(`${result.stdout}\n${result.stderr}`)) {
    throw new Error((result.stderr || result.stdout).trim());
  }
  process.stdout.write("Apfel-Hafen wurde für diese Sitzung beendet.\n");
}

async function status() {
  const installed = existsSync(launchAgentPath);
  const running = launchctl(["print", target], { allowFailure: true }).status === 0;
  let configuredNode = "";
  if (installed) {
    const plist = await readFile(launchAgentPath, "utf8");
    configuredNode = plist.includes(nodePath) ? nodePath : "andere Installation";
  }
  process.stdout.write(JSON.stringify({ installed, running, launchAgentPath, configuredNode }, null, 2) + "\n");
  if (!running) process.exitCode = 1;
}

const command = process.argv[2];
try {
  if (command === "start") await start();
  else if (command === "stop") stop();
  else if (command === "status") await status();
  else throw new Error("Aufruf: service-control.mjs start|stop|status");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
