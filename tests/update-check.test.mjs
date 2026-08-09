import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isLocalImageReference, shouldPullImage, updateCheckResult } from "../lib/image-policy.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("recognizes local image references without requesting a registry pull", () => {
  assert.equal(isLocalImageReference("local/resilio-sync:3.1.2.1076"), true);
  assert.equal(isLocalImageReference(" LOCAL/example:1 "), true);
  assert.equal(shouldPullImage("local/resilio-sync:3.1.2.1076"), false);
});

test("keeps registry pulls enabled for public images", () => {
  assert.equal(isLocalImageReference("docker.io/library/nginx:latest"), false);
  assert.equal(shouldPullImage("docker.io/library/nginx:latest"), true);
  assert.equal(shouldPullImage("ghcr.io/example/app:latest"), true);
});

test("reports an unchanged local image with a visible local-image message", () => {
  assert.deepEqual(updateCheckResult("local/resilio-sync:3.1.2.1076", "sha256:same", "sha256:same"), {
    available: false,
    message: "Lokales Image ist aktuell. Für lokale Images ist kein Registry-Update verfügbar.",
  });
});

test("reports an unchanged public image without offering replacement", () => {
  assert.deepEqual(updateCheckResult("docker.io/library/nginx:latest", "sha256:same", "sha256:same"), {
    available: false,
    message: "Kein Image-Update verfügbar.",
  });
});

test("reports changed digests as available for local and public images", () => {
  for (const reference of ["local/resilio-sync:3.1.2.1076", "docker.io/library/nginx:latest"]) {
    assert.deepEqual(updateCheckResult(reference, "sha256:old", "sha256:new"), {
      available: true,
      message: "Image-Update ist verfügbar.",
    });
  }
});

test("the frontend displays the update-check response message", async () => {
  const source = await readFile(join(root, "src/main.jsx"), "utf8");
  assert.match(source, /setNotice\(data\.message \|\| "OK"\)/);
});
