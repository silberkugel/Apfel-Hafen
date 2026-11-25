// Meta-Tests for the release/start chain: no PATH node fallback, explicit
// ad-hoc signing warnings, fresh checksums, and launchd install integrity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("start command only uses the bundled or an explicitly provided node", async () => {
  const start = await readFile(new URL("../Start-Apfel-Hafen.command", import.meta.url), "utf8");
  assert.doesNotMatch(start, /NODE_BIN="\$\(command -v node/, "kein globaler PATH-Fallback als Startquelle");
  assert.match(start, /APFEL_HAFEN_NODE/, "Entwickler-Override ist explizit");
});

test("build scripts warn on ad-hoc signing and honor the developer identity", async () => {
  const [app, release] = await Promise.all([
    readFile(new URL("../scripts/build-app.sh", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-release.sh", import.meta.url), "utf8"),
  ]);
  assert.match(app, /APFEL_HAFEN_SIGNING_IDENTITY/);
  assert.match(app, /Ad-hoc-Signierung/, "stiller Ad-hoc-Standard ist jetzt eine Warnung");
  assert.match(release, /RELEASE_SIGNING_IDENTITY.*APFEL_HAFEN_SIGNING_IDENTITY/);
  assert.match(release, /--timestamp --options runtime --sign "\$RELEASE_SIGNING_IDENTITY"/, "pam-auth nutzt die Developer-ID");
});

test("node runtime checksum list is fetched fresh on every release build", async () => {
  const release = await readFile(new URL("../scripts/build-release.sh", import.meta.url), "utf8");
  assert.match(release, /curl --fail --location --proto '=https' --tlsv1\.2 \\\n\s*"\$SHASUMS_URL" --output "\$CACHE_DIR\/SHASUMS256-\$NODE_VERSION\.txt\.tmp"/, "Summenliste wird stets neu geladen");
  assert.match(release, /mv "\$CACHE_DIR\/SHASUMS256-\$NODE_VERSION\.txt\.tmp"/, "nur vollständige Listen werden übernommen");
});

test("launchd install refuses group- or world-writable install chains", async () => {
  const control = await readFile(new URL("../service-control.mjs", import.meta.url), "utf8");
  assert.match(control, /function assertInstallationIntegrity\(\)/);
  assert.match(control, /stat\.mode & 0o022/);
  assert.match(control, /assertInstallationIntegrity\(\);/, "Prüfung ist im Installationspfad verdrahtet");
});
