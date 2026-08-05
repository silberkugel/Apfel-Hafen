import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareApplicationData } from "../lib/app-paths.mjs";

test("migrates legacy settings, certificates, and backups without overwriting", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "apfel-hafen-paths-"));
  const project = join(temporary, "project");
  const target = join(temporary, "application-support");
  try {
    await mkdir(join(project, "data", "tls"), { recursive: true });
    await mkdir(join(project, "backups", "demo"), { recursive: true });
    await writeFile(join(project, "data", "settings.json"), '{"listenHost":"0.0.0.0"}');
    await writeFile(join(project, "data", "tls", "custom-cert.pem"), "legacy-certificate");
    await writeFile(join(project, "backups", "demo", "backup.json"), "legacy-backup");

    const first = await prepareApplicationData(project, { APFEL_HAFEN_DATA_DIR: target });
    assert.deepEqual(first.migrated, ["settings", "tls", "backups"]);
    assert.equal(await readFile(first.settings, "utf8"), '{"listenHost":"0.0.0.0"}');

    await writeFile(first.settings, '{"listenHost":"127.0.0.1"}');
    const second = await prepareApplicationData(project, { APFEL_HAFEN_DATA_DIR: target });
    assert.deepEqual(second.migrated, []);
    assert.equal(await readFile(second.settings, "utf8"), '{"listenHost":"127.0.0.1"}');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
