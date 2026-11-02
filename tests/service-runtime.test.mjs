import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireServiceLock, releaseServiceLock, serviceRuntimePaths } from "../lib/service-runtime.mjs";

test("runtime lock and MCP token use the real user support directory", () => {
  const paths = serviceRuntimePaths("/Users/actual-user");
  assert.equal(paths.mcpToken, "/Users/actual-user/Library/Application Support/Apfel-Hafen/mcp-token");
  assert.equal(paths.lock, "/Users/actual-user/Library/Application Support/Apfel-Hafen/service.lock");
});

test("service lock permits only one live process and records its start identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "apfel-hafen-lock-"));
  const lockPath = join(directory, "service.lock");
  const first = await acquireServiceLock(lockPath, { pid: process.pid, startId: "start-one" });
  const second = await acquireServiceLock(lockPath, { pid: process.pid, startId: "start-two" });

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.owner.startId, "start-one");
  assert.deepEqual(JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8")).pid, process.pid);

  releaseServiceLock(first);
  const third = await acquireServiceLock(lockPath, { pid: process.pid, startId: "start-three" });
  assert.equal(third.acquired, true);
  releaseServiceLock(third);
});

test("service log lines contain ISO timestamps, PID and start ID on both streams", () => {
  const moduleUrl = new URL("../lib/service-runtime.mjs", import.meta.url).href;
  const script = `import { installServiceLogContext } from ${JSON.stringify(moduleUrl)}; installServiceLogContext({ pid: 123, startId: "test-start" }); console.log("stdout line"); console.error("stderr line");`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8" });
  const prefix = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] pid=123 start=test-start /;

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim().split("\n").length, 2);
  assert.equal(result.stderr.trim().split("\n").length, 2);
  for (const line of [...result.stdout.trim().split("\n"), ...result.stderr.trim().split("\n")]) assert.match(line, prefix);
});
