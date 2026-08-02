import test from "node:test";
import assert from "node:assert/strict";
import { parseContainers } from "../lib/container-parser.mjs";
import { buildCreateArgs, imageDigestFromInspect, pinnedImage } from "../lib/recreate-args.mjs";

const record = {
  id: "evcc",
  configuration: {
    image: { reference: "docker.io/evcc/evcc:latest", descriptor: { digest: "sha256:old" } },
    initProcess: { executable: "/entrypoint", arguments: ["evcc"], environment: ["TZ=Europe/Berlin"], user: { id: { uid: 0, gid: 0 } }, workingDirectory: "/app" },
    mounts: [{ source: "/host/config", destination: "/etc/config", options: [] }],
    publishedPorts: [{ hostAddress: "0.0.0.0", hostPort: 7070, containerPort: 7070, proto: "tcp" }],
    networks: [{ network: "default", options: { mtu: 1280 } }],
    platform: { os: "linux", architecture: "arm64" },
    resources: { cpus: 2, memoryInBytes: 1073741824 },
  },
  status: { state: "running" },
};

test("parses Apple Container JSON including display details", () => {
  assert.deepEqual(parseContainers(JSON.stringify([record])), [{
    name: "evcc",
    status: "running",
    image: "docker.io/evcc/evcc:latest",
    digest: "sha256:old",
    cpus: 2,
    memoryInBytes: 1073741824,
    volumes: [{ source: "/host/config", destination: "/etc/config", readOnly: false }],
    ports: [{ hostAddress: "0.0.0.0", hostPort: 7070, containerPort: 7070, protocol: "tcp" }],
  }]);
});

test("sorts container names alphabetically and case-insensitively", () => {
  const rows = [
    { ...record, id: "n8n" },
    { ...record, id: "apple-mqtt" },
    { ...record, id: "AnythingLLM" },
    { ...record, id: "evcc" },
  ];
  assert.deepEqual(parseContainers(JSON.stringify(rows)).map((item) => item.name), [
    "AnythingLLM",
    "apple-mqtt",
    "evcc",
    "n8n",
  ]);
});

test("builds a shell-free recreation argument list", () => {
  const args = buildCreateArgs(record, "docker.io/evcc/evcc:latest");
  assert.deepEqual(args.slice(0, 3), ["create", "--name", "evcc"]);
  assert.ok(args.includes("/host/config:/etc/config"));
  assert.ok(args.includes("0.0.0.0:7070:7070/tcp"));
  assert.equal(args.at(-2), "docker.io/evcc/evcc:latest");
  assert.equal(args.at(-1), "evcc");
});

test("uses a temporary name for non-destructive preflight creation", () => {
  const args = buildCreateArgs(record, "docker.io/evcc/evcc:latest", "evcc-update-test");
  assert.deepEqual(args.slice(0, 3), ["create", "--name", "evcc-update-test"]);
});

test("reads image digests and pins rollback references", () => {
  assert.equal(imageDigestFromInspect('[{"configuration":{"descriptor":{"digest":"sha256:new"}}}]'), "sha256:new");
  assert.equal(pinnedImage("docker.io/evcc/evcc:latest", "sha256:old"), "docker.io/evcc/evcc@sha256:old");
});
