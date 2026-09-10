import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseImages, imageActionArgs, registryAction, buildImageArgs, safeLogOptions } from "../lib/container-operations.mjs";
import { parseImageNames } from "../lib/container-create.mjs";
import { OperationStore } from "../lib/operation-store.mjs";
import { filterLogText } from "../src/log-filter.mjs";

test("reads container 1.1 image resources and legacy references", () => {
  const json = JSON.stringify([{ configuration: { name: "alpine:latest", descriptor: { digest: "sha256:abc", size: 20 } }, variants: [{ platform: { architecture: "arm64" }, size: 100 }, { platform: { architecture: "amd64" }, size: 200 }] }]);
  assert.deepEqual(parseImageNames(json), ["alpine:latest"]);
  assert.equal(parseImages(json)[0].reference, "alpine:latest");
  assert.equal(parseImages(json)[0].sizeInBytes, 300);
  assert.equal(parseImages(json)[0].architecture, "arm64, amd64");
  assert.equal(parseImages('[{"reference":"busybox:latest"}]')[0].reference, "busybox:latest");
});

test("validates operation arguments and keeps credentials off command line", () => {
  assert.throws(() => imageActionArgs("pull", { reference: "--help" }));
  assert.throws(() => buildImageArgs({ tag: "demo:latest", context: ".", architectures: ["arm64"] }));
  assert.throws(() => buildImageArgs({ tag: "demo:latest", context: "/tmp", architectures: ["invalid"] }));
  assert.deepEqual(buildImageArgs({ tag: "demo:latest", context: "/tmp", architectures: ["arm64", "amd64"] }), ["build", "--tag", "demo:latest", "--progress", "plain", "--arch", "arm64", "--arch", "amd64", "/tmp"]);
  const login = registryAction("login", { host: "example.com", username: "user", password: "secret" });
  assert.equal(login.input, "secret\n");
  assert.ok(!login.args.includes("secret"));
  assert.throws(() => safeLogOptions({ tail: 5001 }));
  assert.deepEqual(safeLogOptions(), { tail: 200, boot: false });
});

test("filters logs by text and timestamp without inventing timestamps", () => {
  const log = "untimed error\n2026-09-10T10:00:00Z ERROR one\n2026-09-10T11:00:00Z ready";
  assert.equal(filterLogText(log, { query: "error", since: "2026-09-10T09:00:00Z" }), "2026-09-10T10:00:00Z ERROR one");
});

test("persists jobs, limits concurrency, redacts registry output and recovers interruption", async () => {
  const directory = await mkdtemp(join(tmpdir(), "apfel-operations-test-"));
  const children = [];
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    children.push(child); return child;
  };
  try {
    const path = join(directory, "operations.json");
    const store = new OperationStore(path, "container", { spawnProcess });
    await store.load();
    await store.start("registry.login", "login", [], { input: "secret" });
    children[0].stdout.write("secret");
    await store.start("image.pull", "pull one", []);
    await assert.rejects(store.start("image.pull", "pull one", []), /already running/);
    await store.start("image.pull", "pull two", []);
    await assert.rejects(store.start("image.pull", "pull three", []), /three operations/);
    children[0].emit("close", 0);
    await new Promise((resolve) => setImmediate(resolve));
    await store.pendingWrite;
    assert.equal(store.list().find((item) => item.kind === "registry.login").status, "succeeded");
    assert.ok(!(await readFile(path, "utf8")).includes("secret"));
    const recovered = new OperationStore(path, "container");
    await recovered.load();
    assert.equal(recovered.list().filter((item) => item.status === "interrupted").length, 2);
    children.slice(1).forEach((child) => child.emit("close", 0));
    await new Promise((resolve) => setImmediate(resolve));
    await store.pendingWrite;
  } finally { await rm(directory, { recursive: true, force: true }); }
});
