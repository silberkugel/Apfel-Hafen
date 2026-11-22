// Memory budget for 0.3.8: a configurable ceiling for the RAM committed by
// running containers plus the builder VM. Apple's container CLI accepts
// overcommitted requests silently, so Apfel-Hafen must gate starts itself.

const defaultBudgetRatio = 0.6;
const highUsageRatio = 0.85;

function bytes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function gibText(value) {
  return `${(bytes(value) / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}

export function resolveMemoryBudget({ memoryBudgetMb, totalBytes } = {}) {
  const total = bytes(totalBytes);
  const automaticBudgetBytes = Math.floor(total * defaultBudgetRatio);
  const custom = Number(memoryBudgetMb);
  const usesCustomBudget = Number.isInteger(custom) && custom > 0;
  return {
    budgetBytes: usesCustomBudget ? custom * 1024 ** 2 : automaticBudgetBytes,
    automaticBudgetBytes,
    usesCustomBudget,
  };
}

export function parseBuilderMemory(output) {
  for (const line of String(output || "").split(/\r?\n/)) {
    if (!line.trim() || /^ID\s/i.test(line.trim())) continue;
    if (!/\brunning\b/i.test(line)) continue;
    const match = line.match(/(\d+(?:[.,]\d+)?)\s*MB\b/i);
    if (match) return Number(match[1].replace(",", ".")) * 1024 ** 2;
  }
  return 0;
}

export function containerMemoryBytes(container) {
  return bytes(container?.memoryLimitBytes) || bytes(container?.memoryInBytes);
}

export function committedMemoryBytes({ containers = [], builderBytes = 0, excludeNames = [] } = {}) {
  const excluded = new Set(excludeNames.map(String));
  const running = containers.filter((item) => item?.status === "running" && !excluded.has(String(item?.name)));
  return running.reduce((sum, item) => sum + containerMemoryBytes(item), 0) + bytes(builderBytes);
}

export function evaluateBudgetStart({ budgetBytes, committedBytes, requestedBytes } = {}) {
  const budget = bytes(budgetBytes);
  const committed = bytes(committedBytes);
  const requested = bytes(requestedBytes);
  const result = {
    budgetBytes: budget,
    committedBytes: committed,
    requestedBytes: requested,
    deltaBytes: Math.max(0, committed + requested - budget),
  };
  return budget > 0 && committed + requested <= budget ? { ...result, allowed: true } : { ...result, allowed: false };
}

export function memoryBlockedMessage({ budgetBytes, committedBytes, requestedBytes, deltaBytes } = {}) {
  return `Arbeitsspeicher-Budget überschritten: Budget ${gibText(budgetBytes)}, verpfändet ${gibText(committedBytes)}, angefragt ${gibText(requestedBytes)}; es fehlen ${gibText(deltaBytes)}. Optionen: nicht benötigte Container stoppen, Limits in der Technik-Zentrale senken oder das Arbeitsspeicher-Budget in der Administration erhöhen.`;
}

export function trackHighUsage(items = [], streaks = new Map(), requiredSamples = 3) {
  const highUsage = [];
  const seen = new Set();
  for (const item of items) {
    const name = String(item?.name || "");
    const limit = containerMemoryBytes(item);
    if (!name || item?.status !== "running" || limit <= 0) continue;
    seen.add(name);
    const ratio = bytes(item.memoryUsageBytes) / limit;
    if (ratio < highUsageRatio) { streaks.delete(name); continue; }
    const streak = (streaks.get(name) || 0) + 1;
    streaks.set(name, streak);
    if (streak >= requiredSamples) highUsage.push({ name, percent: Math.round(ratio * 100) });
  }
  for (const name of [...streaks.keys()]) if (!seen.has(name)) streaks.delete(name);
  return highUsage;
}

export function assertStartAllowed({ budgetBytes, committedBytes, requestedBytes } = {}) {
  const evaluation = evaluateBudgetStart({ budgetBytes, committedBytes, requestedBytes });
  if (!evaluation.allowed) throw new Error(memoryBlockedMessage(evaluation));
  return evaluation;
}

export function budgetRecommendations({ budgetBytes, committedBytes, highUsage = [] } = {}) {
  const result = [];
  if (bytes(budgetBytes) > 0 && bytes(committedBytes) > bytes(budgetBytes)) {
    result.push({ severity: "critical", code: "memoryBudgetCommitted", containers: [] });
  }
  if (highUsage.length) {
    result.push({ severity: "warning", code: "memoryHighUsage", containers: highUsage.map((item) => `${item.name} (${item.percent} %)`).sort((left, right) => left.localeCompare(right, "de")) });
  }
  return result;
}
