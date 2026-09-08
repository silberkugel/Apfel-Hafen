import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseContainers } from "../lib/container-parser.mjs";
import { buildCreateArgs, editableContainerSettings, imageDigestFromInspect, pinnedImage } from "../lib/recreate-args.mjs";
import { buildNewContainerArgs, parseImageNames, safeVolumeSource, validateContainerDraft, validateContainerSettings } from "../lib/container-create.mjs";
import { normalizeListenHost, requestMatchesOrigin } from "../lib/network-settings.mjs";
import { ensureFallbackCertificate, installCustomCertificate, loadTlsCertificate, removeCustomCertificate } from "../lib/tls-certificates.mjs";

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

test("extracts editable settings and applies overrides while preserving other options", () => {
  const settings = editableContainerSettings(record);
  assert.deepEqual(settings.variables, [{ key: "TZ", value: "Europe/Berlin" }]);
  assert.deepEqual(settings.arguments, ["evcc"]);
  assert.equal(settings.memoryMb, 1024);
  const changed = validateContainerSettings({ ...settings, cpus: 4, ports: [{ hostPort: 8080, containerPort: 80, protocol: "tcp" }] });
  const args = buildCreateArgs(record, settings.image, null, changed);
  assert.ok(args.includes("4"));
  assert.ok(args.includes("1024M"));
  assert.ok(args.includes("8080:80/tcp"));
  assert.ok(args.includes("--network"));
});

test("rejects conflicting edit ports and relative edit volume sources", () => {
  assert.throws(() => validateContainerSettings({ cpus: 2, memoryMb: 512, ports: [{ hostPort: 8080, containerPort: 80, protocol: "tcp" }] }, [{ hostPort: 8080, protocol: "tcp" }]), /bereits belegt/);
  assert.throws(() => validateContainerSettings({ cpus: 2, memoryMb: 512, volumes: [{ source: "relative", destination: "/data" }] }), /Host-Pfad/);
  assert.throws(() => validateContainerSettings({ cpus: 1.5, memoryMb: 512 }), /ganze Zahl/);
});

test("reads image digests and pins rollback references", () => {
  assert.equal(imageDigestFromInspect('[{"configuration":{"descriptor":{"digest":"sha256:new"}}}]'), "sha256:new");
  assert.equal(pinnedImage("docker.io/evcc/evcc:latest", "sha256:old"), "docker.io/evcc/evcc@sha256:old");
});

test("validates and builds arguments for a new container", () => {
  const draft = validateContainerDraft({
    name: "web-1",
    image: "docker.io/library/nginx:latest",
    cpus: 2,
    memoryMb: 1024,
    start: true,
    arguments: ["gateway", "run"],
    variables: [{ key: "APP_ENV", value: "production" }],
    ports: [{ hostPort: 8080, containerPort: 80, protocol: "tcp" }],
    volumes: [{ subpath: "web-1/data", destination: "/data", readOnly: false }],
  }, "/ContainerVolumes", []);
  assert.deepEqual(buildNewContainerArgs(draft), [
    "create", "--name", "web-1",
    "--cpus", "2", "--memory", "1024M",
    "--env", "APP_ENV=production",
    "--publish", "8080:80/tcp",
    "--volume", "/ContainerVolumes/web-1/data:/data",
    "docker.io/library/nginx:latest", "gateway", "run",
  ]);
});

test("edits startup arguments without invoking a shell", () => {
  const settings = editableContainerSettings(record);
  const changed = validateContainerSettings({ ...settings, arguments: ["gateway", "run; echo unsafe"] });
  const args = buildCreateArgs(record, settings.image, null, changed);
  assert.deepEqual(args.slice(-3), [settings.image, "gateway", "run; echo unsafe"]);
  assert.throws(() => validateContainerSettings({ ...settings, arguments: new Array(129).fill("x") }), /128 Startargumente/);
  assert.throws(() => validateContainerSettings({ ...settings, arguments: ["bad\0argument"] }), /ungültig/);
});

test("rejects occupied ports and volume path traversal", () => {
  assert.throws(() => validateContainerDraft({ name: "web", image: "nginx", cpus: 2, memoryMb: 1024, ports: [{ hostPort: 8080, containerPort: 80, protocol: "tcp" }] }, "/Volumes", [{ hostPort: 8080, protocol: "tcp" }]), /bereits belegt/);
  assert.throws(() => safeVolumeSource("/Volumes", "../private"), /außerhalb/);
  assert.throws(() => validateContainerDraft({ name: "web", image: "nginx", cpus: 0, memoryMb: 1024 }, "/Volumes"), /CPU-Anzahl/);
  assert.throws(() => validateContainerDraft({ name: "web", image: "nginx", cpus: 1.5, memoryMb: 1024 }, "/Volumes"), /ganze Zahl/);
  assert.throws(() => validateContainerDraft({ name: "web", image: "nginx", cpus: 2, memoryMb: 32 }, "/Volumes"), /Arbeitsspeicher/);
});

test("extracts and sorts local image references", () => {
  assert.deepEqual(parseImageNames(JSON.stringify([{ name: "nginx:latest" }, { reference: "alpine:latest" }, { names: ["nginx:latest", "busybox:1"] }])), ["alpine:latest", "busybox:1", "nginx:latest"]);
});

test("validates listener settings and same-origin requests", () => {
  assert.equal(normalizeListenHost("0.0.0.0"), "0.0.0.0");
  assert.equal(normalizeListenHost("192.168.1.5"), "127.0.0.1");
  assert.equal(requestMatchesOrigin("https://192.168.1.20:4173", "192.168.1.20:4173"), true);
  assert.equal(requestMatchesOrigin("https://example.invalid:4173", "192.168.1.20:4173"), false);
  assert.equal(requestMatchesOrigin("http://192.168.1.20:4173", "192.168.1.20:4173"), false);
});

test("generates TLS fallback and switches custom certificates safely", async () => {
  const root = await mkdtemp(join(tmpdir(), "apfel-hafen-tls-"));
  try {
    const fallback = await ensureFallbackCertificate(root);
    assert.match(fallback.cert, /BEGIN CERTIFICATE/);
    assert.match(fallback.key, /BEGIN PRIVATE KEY/);
    assert.equal((await loadTlsCertificate(root)).status.source, "fallback");
    assert.equal((await stat(join(root, "tls/fallback-key.pem"))).mode & 0o777, 0o600);
    assert.equal((await installCustomCertificate(root, fallback.cert, fallback.key)).status.source, "custom");
    assert.equal((await loadTlsCertificate(root)).status.source, "custom");
    assert.equal((await removeCustomCertificate(root)).status.source, "fallback");
    assert.equal((await loadTlsCertificate(root)).status.source, "fallback");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
