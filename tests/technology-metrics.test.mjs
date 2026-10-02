import test from "node:test";
import assert from "node:assert/strict";
import { cpuUsage, parseContainerDiskUsage, parseContainerStats, parseContainerSystemStatus, parseMemoryPressure, parseSize, parseThermalState, parseVmStat, recommendations } from "../lib/technology-metrics.mjs";

test("parses macOS memory pressure and VM statistics", () => {
  const total = 16 * 1024 ** 3;
  const vm = parseVmStat(`Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free: 100000.
Pages inactive: 200000.
Pages speculative: 10000.
Pages purgeable: 5000.
Pages wired down: 120000.
Pages occupied by compressor: 30000.`, total);
  const memory = parseMemoryPressure("System-wide memory free percentage: 12%", vm);
  assert.equal(memory.pressure, "warning");
  assert.equal(memory.wiredBytes, 120000 * 16384);
  assert.ok(memory.usedPercent > 60);
});

test("calculates host CPU use from cumulative ticks", () => {
  assert.equal(cpuUsage({ idle: 100, total: 200 }, { idle: 130, total: 300 }), 70);
  assert.equal(cpuUsage(null, { idle: 100, total: 200 }), 0);
});

test("turns cumulative Apple Container stats into rates", () => {
  const previous = new Map([["web", { sampledAt: 1000, cpuUsageUsec: 1_000_000, networkRxBytes: 100, networkTxBytes: 200, blockReadBytes: 300, blockWriteBytes: 400 }]]);
  const output = JSON.stringify([{ id: "web", cpuUsageUsec: 2_000_000, memoryUsageBytes: 512, memoryLimitBytes: 1024, networkRxBytes: 600, networkTxBytes: 1200, blockReadBytes: 2300, blockWriteBytes: 3400, numProcesses: 3 }]);
  const result = parseContainerStats(output, previous, 6000);
  assert.equal(result.stats[0].cpuPercent, 20);
  assert.equal(result.stats[0].networkRxBytesPerSecond, 100);
  assert.equal(result.stats[0].blockWriteBytesPerSecond, 600);
  assert.equal(result.stats[0].numProcesses, 3);
});

test("parses JSON and table disk usage", () => {
  const json = parseContainerDiskUsage(JSON.stringify([{ type: "Images", total: 2, active: 1, sizeInBytes: 2048, reclaimableInBytes: 1024 }]));
  assert.equal(json.sizeBytes, 2048);
  assert.equal(json.reclaimableBytes, 1024);
  const table = parseContainerDiskUsage("TYPE TOTAL ACTIVE SIZE RECLAIMABLE\nImages 2 1 3.2GB 1.1GB (34%)");
  assert.equal(table.resources[0].total, 2);
  assert.equal(table.sizeBytes, 3_200_000_000);
  assert.equal(parseSize("1.5 GiB"), 1.5 * 1024 ** 3);
});

test("keeps unavailable thermal data honest and derives recommendations", () => {
  assert.equal(parseThermalState("Error: No CPU power status").state, "unavailable");
  assert.equal(parseThermalState("CPU_Speed_Limit = 75\nScheduler_Limit = 100").state, "warning");
  const result = recommendations({ host: { memory: { pressure: "warning", totalBytes: 1000 }, disk: { usedPercent: 90 } }, containers: { disk: { reclaimableBytes: 2 * 1024 ** 3 }, items: [{ memoryLimitBytes: 950 }] } });
  assert.deepEqual(result.map((item) => item.code), ["memoryPressure", "diskSpace", "reclaimableStorage", "overcommittedMemory"]);
});

test("does not mistake an unregistered Apple Container service for running", () => {
  assert.equal(parseContainerSystemStatus('{"status":"unregistered"}'), false);
  assert.equal(parseContainerSystemStatus('{"status":"running"}'), true);
  assert.equal(parseContainerSystemStatus("Status: not running"), false);
});
