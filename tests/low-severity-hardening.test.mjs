// Low-severity hardening: body decoding, static path containment, error echo
// suppression and registry pagination pinning (unit + source meta checks).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { pinnedNextUrl } from "../lib/registry-tags.mjs";

test("readBody joins bytes before decoding and limits by byte size", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /Buffer\.concat\(chunks\)\.toString\("utf8"\)/, "Dekodierung erst nach dem Aneinanderfügen");
  assert.match(server, /received \+= bytes\.length/, "Limit zählt Bytes, keine UTF-16-Einheiten");
  assert.doesNotMatch(server, /raw \+= chunk/, "kein zeichenweises Aneinanderfügen mehr");
});

test("serveStatic requires a path separator after the dist prefix", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /file\.startsWith\(dist \+ "\/"\)/, "Präfix nur mit Separator, /distmatcht nicht /district");
});

test("unauthenticated API errors stay generic, login feedback survives", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /if \(!currentSession\(req\)\) \{[\s\S]*console\.error[\s\S]*Interner Fehler/, "Gäste erhalten nur einen neutralen 500er");
  assert.match(server, /return json\(res, 401, \{ error: error\.message \}\)/, "Login-Ablehnung antwortet direkt, nicht über den generischen Catch");
});

test("pam-auth reads stdin fully via getdelim", async () => {
  const c = await readFile(new URL("../auth/pam-auth.c", import.meta.url), "utf8");
  assert.match(c, /getdelim\(&line, &capacity, '\\n', stdin\)/, "Einzeiliges Lesen ohne 1024-Byte-Abschneiden");
  assert.match(c, /memset\(line, 0, strlen\(line\)\);[\s\S]*free\(line\);/, "Passwort-Speicher wird geräumt");
});

test("registry pagination stays on the expected host", () => {
  assert.equal(pinnedNextUrl("/v2/o/r/tags/list?n=1000&after=x", "ghcr.io"), "https://ghcr.io/v2/o/r/tags/list?n=1000&after=x");
  assert.equal(pinnedNextUrl("https://ghcr.io/v2/o/r/tags/list?after=x", "ghcr.io"), "https://ghcr.io/v2/o/r/tags/list?after=x");
  assert.equal(pinnedNextUrl("https://evil.example/exfil", "ghcr.io"), null, "fremder Host wird verworfen");
  assert.equal(pinnedNextUrl("http://ghcr.io/v2/o/r/tags/list", "ghcr.io"), null, "kein Klartext-HTTP");
  assert.equal(pinnedNextUrl("https://registry.hub.docker.com/v2/repositories/o/r/tags?page=2", "registry.hub.docker.com"), "https://registry.hub.docker.com/v2/repositories/o/r/tags?page=2");
  assert.equal(pinnedNextUrl("https://evil.example/x", "registry.hub.docker.com"), null);
  assert.equal(pinnedNextUrl(null, "ghcr.io"), null);
});
