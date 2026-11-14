import test from "node:test";
import assert from "node:assert/strict";
import {
  compareVersions,
  findNewerVersion,
  isVersionTag,
  latestVersionTag,
  parseImageReference,
  parseVersionTag,
  withTag,
} from "../lib/registry-tags.mjs";

const DIGEST = "sha256:" + "a1b2c3d4".repeat(8);

test("parses registry, repository and tag from image references", () => {
  assert.deepEqual(parseImageReference("ghcr.io/open-webui/open-webui:v0.13.2"), {
    registry: "ghcr.io",
    repository: "open-webui/open-webui",
    tag: "v0.13.2",
    digest: null,
  });
  assert.deepEqual(parseImageReference("nginx:1.27"), {
    registry: "docker.io",
    repository: "library/nginx",
    tag: "1.27",
    digest: null,
  });
  assert.deepEqual(parseImageReference("docker.io/library/nginx"), {
    registry: "docker.io",
    repository: "library/nginx",
    tag: null,
    digest: null,
  });
  assert.deepEqual(parseImageReference(`ghcr.io/open-webui/open-webui@${DIGEST}`), {
    registry: "ghcr.io",
    repository: "open-webui/open-webui",
    tag: null,
    digest: DIGEST,
  });
  assert.deepEqual(parseImageReference("localhost:5000/team/app:2.1.0"), {
    registry: "localhost:5000",
    repository: "team/app",
    tag: "2.1.0",
    digest: null,
  });
  assert.equal(parseImageReference("invalid image"), null);
  assert.equal(parseImageReference("docker.io/nginx@not-a-digest"), null);
  assert.equal(parseImageReference(""), null);
});

test("replaces only the tag and keeps the original reference form", () => {
  assert.equal(withTag("ghcr.io/open-webui/open-webui:v0.13.2", "v0.13.3"), "ghcr.io/open-webui/open-webui:v0.13.3");
  assert.equal(withTag(`ghcr.io/open-webui/open-webui@${DIGEST}`, "v0.13.3"), "ghcr.io/open-webui/open-webui:v0.13.3");
  assert.equal(withTag("nginx:1.27", "1.28"), "nginx:1.28");
  assert.equal(withTag("nginx", "1.28"), "nginx:1.28");
  assert.equal(withTag("", "1.0"), null);
});

test("recognizes version tags and ignores moving tags", () => {
  assert.equal(isVersionTag("v0.13.2"), true);
  assert.equal(isVersionTag("1.27"), true);
  assert.equal(isVersionTag("v0.13.2-cuda"), true);
  assert.equal(isVersionTag("2026.11.14"), true);
  assert.equal(isVersionTag("latest"), false);
  assert.equal(isVersionTag("main"), false);
  assert.equal(isVersionTag("dev-20261114"), false);
  assert.deepEqual(parseVersionTag("v0.13.2"), { major: 0, minor: 13, patch: 2, suffix: null });
  assert.equal(parseVersionTag("v0.13.2-cuda").suffix, "cuda");
  assert.equal(parseVersionTag("latest"), null);
});

test("compares versions numerically, not lexically", () => {
  const v = (tag) => parseVersionTag(tag);
  assert.ok(compareVersions(v("v0.13.10"), v("v0.13.9")) > 0);
  assert.ok(compareVersions(v("v0.9.0"), v("v0.13.0")) < 0);
  assert.equal(compareVersions(v("v1.2.3"), v("1.2.3")), 0);
});

test("finds the newest version above the current one", () => {
  const tags = [
    "main",
    "latest",
    "v0.12.9",
    "v0.13.0",
    "v0.13.1",
    "v0.13.2",
    "v0.13.2-cuda",
    "v0.13.3",
    "v0.13.3-cuda",
    "v0.13.3-slim",
  ];
  assert.equal(findNewerVersion("v0.13.2", tags), "v0.13.3");
  assert.equal(findNewerVersion("v0.13.3", tags), null);
  assert.equal(findNewerVersion("v0.12.9", tags), "v0.13.3");
  assert.equal(findNewerVersion("latest", tags), null);
});

test("keeps the variant suffix when finding newer versions", () => {
  const tags = ["v0.13.2-cuda", "v0.13.3", "v0.13.3-cuda", "v0.13.3-cuda126"];
  assert.equal(findNewerVersion("v0.13.2-cuda", tags), "v0.13.3-cuda");
  assert.equal(findNewerVersion("v0.13.2-cuda126", ["v0.13.2-cuda126", "v0.13.3-cuda126"]), "v0.13.3-cuda126");
});

test("keeps the v-prefix style of the current tag", () => {
  const tags = ["0.13.3", "v0.13.3", "0.13.2", "v0.13.2"];
  assert.equal(findNewerVersion("v0.13.2", tags), "v0.13.3");
  assert.equal(findNewerVersion("0.13.2", tags), "0.13.3");
  assert.equal(latestVersionTag(["0.13.3", "v0.13.3"]), "v0.13.3");
});

test("picks the plain tag when several variants share the newest version", () => {
  assert.equal(latestVersionTag(["v0.13.3-cuda", "v0.13.3", "v0.13.3-slim", "main"]), "v0.13.3");
  assert.equal(latestVersionTag(["v0.13.3-cuda", "v0.13.2"]), "v0.13.3-cuda");
  assert.equal(latestVersionTag(["main", "latest"]), null);
});
