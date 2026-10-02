const sizeUnits = { b: 1, kb: 1_000, mb: 1_000_000, gb: 1_000_000_000, tb: 1_000_000_000_000, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseSize(value) {
  if (typeof value === "number") return finite(value);
  const match = String(value ?? "").trim().replace(/,/g, ".").match(/^([\d.]+)\s*([kmgt]?i?b)?/i);
  if (!match) return 0;
  return finite(match[1]) * (sizeUnits[(match[2] || "b").toLowerCase()] || 1);
}

export function parseVmStat(output, totalBytes) {
  const pageSize = finite(String(output).match(/page size of\s+(\d+)\s+bytes/i)?.[1], 4096);
  const values = {};
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s+([\d.]+)/);
    if (match) values[match[1].trim().toLowerCase()] = finite(match[2].replace(/\./g, ""));
  }
  const pages = (...names) => names.reduce((sum, name) => sum + finite(values[name]), 0);
  const availablePages = pages("pages free", "pages inactive", "pages speculative", "pages purgeable");
  const wiredPages = pages("pages wired down");
  const compressedPages = pages("pages occupied by compressor");
  const availableBytes = Math.min(totalBytes, availablePages * pageSize);
  return {
    totalBytes,
    usedBytes: Math.max(0, totalBytes - availableBytes),
    availableBytes,
    wiredBytes: wiredPages * pageSize,
    compressedBytes: compressedPages * pageSize,
  };
}

export function parseMemoryPressure(output, memory) {
  const freePercent = finite(String(output).match(/free percentage:\s*(\d+)%/i)?.[1], -1);
  const usedPercent = memory.totalBytes ? Math.round((memory.usedBytes / memory.totalBytes) * 100) : 0;
  const level = freePercent >= 0 ? (freePercent < 5 ? "critical" : freePercent < 15 ? "warning" : "normal") : (usedPercent >= 95 ? "critical" : usedPercent >= 85 ? "warning" : "normal");
  return { ...memory, usedPercent, pressure: level, pressureFreePercent: freePercent >= 0 ? freePercent : null };
}

export function parseSwapUsage(output) {
  const used = String(output).match(/used\s*=\s*([\d.]+)([MG]?)M?/i);
  if (!used) return 0;
  const multiplier = used[2].toUpperCase() === "G" ? 1024 ** 3 : 1024 ** 2;
  return finite(used[1]) * multiplier;
}

export function cpuTotals(cpus = []) {
  return cpus.reduce((result, cpu) => {
    const times = cpu?.times || {};
    result.idle += finite(times.idle);
    result.total += Object.values(times).reduce((sum, value) => sum + finite(value), 0);
    return result;
  }, { idle: 0, total: 0 });
}

export function cpuUsage(previous, current) {
  if (!previous) return 0;
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 1000) / 10));
}

function jsonRecords(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function parseContainerStats(output, previous = new Map(), sampledAt = Date.now()) {
  const next = new Map();
  const stats = jsonRecords(output).map((record) => {
    const id = String(record.id || record.name || record.containerID || "").trim();
    const raw = {
      cpuUsageUsec: finite(record.cpuUsageUsec ?? record.cpuUsageMicroseconds),
      memoryUsageBytes: finite(record.memoryUsageBytes),
      memoryLimitBytes: finite(record.memoryLimitBytes),
      networkRxBytes: finite(record.networkRxBytes),
      networkTxBytes: finite(record.networkTxBytes),
      blockReadBytes: finite(record.blockReadBytes),
      blockWriteBytes: finite(record.blockWriteBytes),
      numProcesses: finite(record.numProcesses ?? record.pids),
    };
    const old = previous.get(id);
    const elapsedSeconds = old ? Math.max(0.001, (sampledAt - old.sampledAt) / 1000) : 0;
    const delta = (key) => old && raw[key] >= old[key] ? (raw[key] - old[key]) / elapsedSeconds : 0;
    next.set(id, { ...raw, sampledAt });
    return {
      id,
      ...raw,
      cpuPercent: old ? Math.round(Math.max(0, delta("cpuUsageUsec") / 10_000) * 10) / 10 : null,
      networkRxBytesPerSecond: delta("networkRxBytes"),
      networkTxBytesPerSecond: delta("networkTxBytes"),
      blockReadBytesPerSecond: delta("blockReadBytes"),
      blockWriteBytesPerSecond: delta("blockWriteBytes"),
    };
  }).filter((record) => record.id);
  return { stats, next };
}

function normalizeDiskRecord(record) {
  const type = String(record.type || record.resourceType || record.kind || "").toLowerCase();
  return {
    type,
    total: finite(record.total ?? record.totalCount ?? record.count),
    active: finite(record.active ?? record.activeCount),
    sizeBytes: parseSize(record.sizeInBytes ?? record.size ?? record.diskUsage),
    reclaimableBytes: parseSize(record.reclaimableInBytes ?? record.reclaimableSize ?? record.reclaimable),
  };
}

export function parseContainerDiskUsage(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) return { resources: [], sizeBytes: 0, reclaimableBytes: 0 };
  let resources;
  try {
    const parsed = JSON.parse(trimmed);
    const records = Array.isArray(parsed) ? parsed : (parsed.resources || parsed.items || []);
    resources = records.map(normalizeDiskRecord);
  } catch {
    resources = trimmed.split(/\r?\n/).slice(1).map((line) => {
      const match = line.trim().match(/^(.+?)\s+(\d+)\s+(\d+)\s+([\d.,]+\s*[KMGT]?i?B)\s+([\d.,]+\s*[KMGT]?i?B)/i);
      return match ? normalizeDiskRecord({ type: match[1], total: match[2], active: match[3], size: match[4], reclaimable: match[5] }) : null;
    }).filter(Boolean);
  }
  return {
    resources,
    sizeBytes: resources.reduce((sum, item) => sum + item.sizeBytes, 0),
    reclaimableBytes: resources.reduce((sum, item) => sum + item.reclaimableBytes, 0),
  };
}

export function parseThermalState(output) {
  const text = String(output || "");
  const cpuLimit = finite(text.match(/CPU_Speed_Limit\s*=\s*(\d+)/i)?.[1], 100);
  const schedulerLimit = finite(text.match(/Scheduler_Limit\s*=\s*(\d+)/i)?.[1], 100);
  if (/error:/i.test(text) && !/CPU_Speed_Limit/i.test(text)) return { state: "unavailable", cpuTemperatureCelsius: null };
  const lowest = Math.min(cpuLimit, schedulerLimit);
  return { state: lowest < 50 ? "critical" : lowest < 100 ? "warning" : "normal", cpuTemperatureCelsius: null };
}

export function parseContainerSystemStatus(output) {
  const text = String(output || "").trim();
  if (!text) return false;
  try {
    const status = String(JSON.parse(text)?.status || "").toLowerCase();
    return ["running", "ready", "healthy", "ok"].includes(status);
  } catch {
    return /\b(running|ready|healthy)\b/i.test(text) && !/\b(not running|unregistered|stopped|inactive)\b/i.test(text);
  }
}

export function recommendations(snapshot) {
  const result = [];
  if (snapshot.host.memory.pressure === "critical") result.push({ severity: "critical", code: "memoryPressure" });
  else if (snapshot.host.memory.pressure === "warning") result.push({ severity: "warning", code: "memoryPressure" });
  if (snapshot.host.disk.usedPercent >= 95) result.push({ severity: "critical", code: "diskSpace" });
  else if (snapshot.host.disk.usedPercent >= 85) result.push({ severity: "warning", code: "diskSpace" });
  if (snapshot.containers.disk.reclaimableBytes >= 1024 ** 3) result.push({ severity: "info", code: "reclaimableStorage" });
  const totalLimits = snapshot.containers.items.reduce((sum, item) => sum + finite(item.memoryLimitBytes), 0);
  if (totalLimits > snapshot.host.memory.totalBytes * 0.9) result.push({ severity: "warning", code: "overcommittedMemory" });
  return result;
}
