import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function applicationPaths(environment = process.env) {
  const base = resolve(environment.APFEL_HAFEN_DATA_DIR || join(homedir(), "Library", "Application Support", "Apfel-Hafen"));
  return {
    base,
    settings: join(base, "settings.json"),
    tls: join(base, "tls"),
    backups: join(base, "backups"),
  };
}

async function copyIfMissing(source, destination) {
  if (!existsSync(source) || existsSync(destination)) return false;
  await cp(source, destination, { recursive: true, errorOnExist: true });
  return true;
}

export async function prepareApplicationData(projectRoot, environment = process.env) {
  const paths = applicationPaths(environment);
  await mkdir(paths.base, { recursive: true, mode: 0o700 });
  const migrated = [];
  if (await copyIfMissing(join(projectRoot, "data", "settings.json"), paths.settings)) migrated.push("settings");
  if (await copyIfMissing(join(projectRoot, "data", "tls"), paths.tls)) migrated.push("tls");
  if (await copyIfMissing(join(projectRoot, "backups"), paths.backups)) migrated.push("backups");
  await mkdir(paths.tls, { recursive: true, mode: 0o700 });
  await mkdir(paths.backups, { recursive: true, mode: 0o700 });
  return { ...paths, migrated };
}
