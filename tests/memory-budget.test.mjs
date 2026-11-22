import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertStartAllowed,
  budgetRecommendations,
  committedMemoryBytes,
  evaluateBudgetStart,
  gibText,
  memoryBlockedMessage,
  parseBuilderMemory,
  resolveMemoryBudget,
  trackHighUsage,
} from "../lib/memory-budget.mjs";

const gib = 1024 ** 3;

test("the automatic memory budget defaults to 60 % of installed RAM", () => {
  const budget = resolveMemoryBudget({ memoryBudgetMb: 0, totalBytes: 16 * gib });
  assert.equal(budget.budgetBytes, Math.floor(16 * gib * 0.6));
  assert.equal(budget.usesCustomBudget, false);
  assert.equal(budget.automaticBudgetBytes, Math.floor(16 * gib * 0.6));
});

test("a configured memory budget overrides the automatic default", () => {
  const budget = resolveMemoryBudget({ memoryBudgetMb: 8192, totalBytes: 16 * gib });
  assert.equal(budget.budgetBytes, 8 * gib);
  assert.equal(budget.usesCustomBudget, true);
});

test("invalid or missing budget settings fall back to the automatic default", () => {
  for (const value of [undefined, null, -4, 1.5, "drei", Number.NaN, 0]) {
    const budget = resolveMemoryBudget({ memoryBudgetMb: value, totalBytes: 16 * gib });
    assert.equal(budget.budgetBytes, Math.floor(16 * gib * 0.6), `fallback for ${String(value)}`);
    assert.equal(budget.usesCustomBudget, false);
  }
});

test("numeric strings from form posts are coerced to a custom budget", () => {
  const budget = resolveMemoryBudget({ memoryBudgetMb: "8192", totalBytes: 16 * gib });
  assert.equal(budget.budgetBytes, 8 * gib);
  assert.equal(budget.usesCustomBudget, true);
});

test("builder memory is read from the running builder status line", () => {
  const output = "ID        IMAGE                                                STATE    IP               CPUS  MEMORY\nbuildkit  ghcr.io/apple/container-builder-shim/builder:0.12.0  running  192.168.64.2/24  2     2048 MB";
  assert.equal(parseBuilderMemory(output), 2048 * 1024 ** 2);
  assert.equal(parseBuilderMemory("ID IMAGE STATE IP CPUS MEMORY\nbuildkit img stopped 192.168.64.2/24 2 2048 MB"), 0);
  assert.equal(parseBuilderMemory(""), 0);
  assert.equal(parseBuilderMemory("Error: not found"), 0);
});

test("committed memory sums running containers and the builder VM", () => {
  const containers = [
    { name: "web", status: "running", memoryLimitBytes: 2 * gib },
    { name: "db", status: "running", memoryLimitBytes: 0, memoryInBytes: gib },
    { name: "batch", status: "stopped", memoryLimitBytes: 4 * gib },
  ];
  assert.equal(committedMemoryBytes({ containers, builderBytes: gib }), 4 * gib);
  assert.equal(committedMemoryBytes({ containers, builderBytes: gib, excludeNames: ["web"] }), 2 * gib);
  assert.equal(committedMemoryBytes({ containers: [], builderBytes: 0 }), 0);
});

test("starts within the budget stay allowed, starts above it are blocked with the full picture", () => {
  const ok = evaluateBudgetStart({ budgetBytes: 8 * gib, committedBytes: 7 * gib, requestedBytes: gib });
  assert.equal(ok.allowed, true);
  const blocked = evaluateBudgetStart({ budgetBytes: 8 * gib, committedBytes: 7.5 * gib, requestedBytes: 2 * gib });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.deltaBytes, 1.5 * gib);
  const message = memoryBlockedMessage(blocked);
  assert.match(message, /^Arbeitsspeicher-Budget überschritten: Budget 8,0 GB, verpfändet 7,5 GB, angefragt 2,0 GB; es fehlen 1,5 GB\./);
  assert.match(message, /Optionen: .*stoppen.*senken.*erhöhen\./);
  assert.equal((message.match(/(stoppen|senken|erhöhen)/g) || []).length, 3);
});

test("assertStartAllowed throws the blocked message and passes allowed starts", () => {
  assert.doesNotThrow(() => assertStartAllowed({ budgetBytes: 8 * gib, committedBytes: 4 * gib, requestedBytes: 4 * gib }));
  assert.throws(
    () => assertStartAllowed({ budgetBytes: 8 * gib, committedBytes: 8 * gib, requestedBytes: 1 * gib }),
    /Arbeitsspeicher-Budget überschritten/,
  );
  assert.equal(gibText(0), "0,0 GB");
});

test("high usage is only warned after sustained samples and recovers when limits free up", () => {
  const streaks = new Map();
  const container = (usage) => ({ name: "busy", status: "running", memoryLimitBytes: 1 * gib, memoryUsageBytes: usage });
  assert.deepEqual(trackHighUsage([container(0.9 * gib)], streaks), []);
  assert.deepEqual(trackHighUsage([container(0.9 * gib)], streaks), []);
  assert.deepEqual(trackHighUsage([container(0.9 * gib)], streaks), [{ name: "busy", percent: 90 }]);
  assert.deepEqual(trackHighUsage([container(0.5 * gib)], streaks), []);
  assert.deepEqual(trackHighUsage([container(0.9 * gib)], streaks), []);
  assert.deepEqual(trackHighUsage([container(0.849 * gib)], streaks, 1), []);
  trackHighUsage([container(0.9 * gib)], streaks, 1);
  trackHighUsage([{ ...container(0.9 * gib), status: "stopped" }], streaks, 1);
  assert.equal(streaks.has("busy"), false);
});

test("budget recommendations report committed overruns and persistent high consumers", () => {
  const recommendations = budgetRecommendations({
    budgetBytes: 8 * gib,
    committedBytes: 9 * gib,
    highUsage: [{ name: "llm", percent: 95 }, { name: "web", percent: 88 }],
  });
  assert.deepEqual(recommendations.map((item) => item.code), ["memoryBudgetCommitted", "memoryHighUsage"]);
  assert.equal(recommendations[0].severity, "critical");
  assert.deepEqual(recommendations[1].containers, ["llm (95 %)", "web (88 %)"]);
  assert.deepEqual(budgetRecommendations({ budgetBytes: 8 * gib, committedBytes: 8 * gib, highUsage: [] }), []);
});

test("the server gates container, stack, and builder starts against the budget", async () => {
  const [server, techCenter] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/TechnologyCenter.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(server, /if \(action === "start"\) \{\s*await assertMemoryBudgetForStart\(containerMemoryBytes\(selected\), \[selected\.name\]\);/);
  assert.match(server, /restart"\) \{\s*await assertMemoryBudgetForStart\(containerMemoryBytes\(selected\), \[selected\.name\]\);/);
  assert.match(server, /if \(action === "start"\) \{\s*const \{ containers \} = await currentState\(\);[\s\S]*?assertMemoryBudgetForStart\(toStart\.reduce/);
  assert.match(server, /assertMemoryBudgetForStart\(manifest\.services\.reduce/);
  assert.match(server, /if \(action === "start"\) await assertMemoryBudgetForStart\(Number\(body\.memoryMb\) \* 1024 \*\* 2\);/);
  assert.match(server, /memoryBudgetMb: 0 \}/);
  assert.match(server, /Ungültiges Arbeitsspeicher-Budget\./);
  assert.match(server, /Arbeitsspeicher-Budget überschritten/);
  assert.match(server, /"Memory budget exceeded: budget \$1, committed \$2, requested \$3, short by \$4\. Options: \$5\."/);
  assert.match(server, /snapshot\.memoryBudget = \{/);
  assert.match(techCenter, /memoryBudgetCommitted/);
  assert.match(techCenter, /memoryHighUsage/);
  assert.match(techCenter, /t\("memoryBudget"\)/);
});
