import test from "node:test";
import assert from "node:assert/strict";
import { imageProjectPath, imageVersion, latestStableTag, openCodeImageResult, openCodeSearchInput, parseComposeOpenCodeImages } from "../lib/opencode-source.mjs";

test("accepts OpenCode project URLs and paths but rejects other hosts", () => {
  assert.deepEqual(openCodeSearchInput("https://gitlab.opencode.de/opentalk/ot-setup"), {
    query: "opentalk/ot-setup",
    projectPath: "opentalk/ot-setup",
  });
  assert.equal(openCodeSearchInput("opentalk/ot-setup.git")?.projectPath, "opentalk/ot-setup");
  assert.equal(openCodeSearchInput("https://example.com/opentalk/ot-setup"), null);
  assert.deepEqual(openCodeSearchInput("OpenTalk"), { query: "OpenTalk", projectPath: null });
});

test("prefers a stable OpenCode tag", () => {
  const tags = [
    { name: "v26.2.2-beta.0" },
    { name: "v26.1.4", created_at: "2026-10-06T10:04:30Z" },
  ];
  assert.equal(latestStableTag(tags)?.name, "v26.1.4");
});

test("selects the highest stable version when OpenCode returns tags out of order", () => {
  assert.equal(latestStableTag([
    { name: "v26.2.2-beta.0" },
    { name: "v26.1.4" },
    { name: "v26.3.0-beta.0" },
    { name: "v26.2.1" },
  ]).name, "v26.2.1");
});

test("extracts only OpenCode registry images from compose defaults", () => {
  const compose = `
services:
  frontend:
    image: \${OT_FRONTEND_IMAGE_SRC:-registry.opencode.de/opentalk/web-frontend}:\${OT_FRONTEND_IMAGE_TAG:-v2.8.9}
  controller:
    image: registry.opencode.de/opentalk/controller:v0.33.8
  database:
    image: postgres:17
  duplicate:
    image: registry.opencode.de/opentalk/controller:v0.33.8
`;
  assert.deepEqual(parseComposeOpenCodeImages(compose), [
    "registry.opencode.de/opentalk/web-frontend:v2.8.9",
    "registry.opencode.de/opentalk/controller:v0.33.8",
  ]);
});

test("builds selectable image metadata with version and release date", () => {
  const reference = "registry.opencode.de/opentalk/web-frontend:v2.8.9";
  assert.equal(imageProjectPath(reference), "opentalk/web-frontend");
  assert.equal(imageVersion(reference), "v2.8.9");
  assert.deepEqual(openCodeImageResult({
    reference,
    project: { name_with_namespace: "OpenTalk / OpenTalk Web Frontend", path_with_namespace: "opentalk/web-frontend", web_url: "https://gitlab.opencode.de/opentalk/web-frontend", description: "Frontend" },
    tag: { name: "v2.8.9", created_at: "2026-09-24T09:27:21Z" },
    sourceProject: { path_with_namespace: "opentalk/ot-setup" },
    sourceVersion: "v26.1.4",
  }), {
    source: "opencode",
    name: "OpenTalk / OpenTalk Web Frontend",
    reference,
    description: "Frontend",
    official: false,
    version: "v2.8.9",
    releasedAt: "2026-09-24T09:27:21Z",
    projectUrl: "https://gitlab.opencode.de/opentalk/web-frontend",
    sourceProject: "opentalk/ot-setup",
    sourceVersion: "v26.1.4",
  });
});
