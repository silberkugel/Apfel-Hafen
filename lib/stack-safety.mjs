import { createHash } from "node:crypto";

export function memoryMegabytes(value, fallback = 1024) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?)(?:i?b)?$/i);
  if (!match) return fallback;
  const factors = { "": 1 / (1024 * 1024), k: 1 / 1024, m: 1, g: 1024, t: 1024 * 1024 };
  return Math.max(64, Math.round(Number(match[1]) * factors[match[2].toLowerCase()]));
}

export function stackManifest(plan, runtime, options = {}) {
  if (!plan?.ready || !Array.isArray(runtime) || runtime.length !== plan.phases.create.length) throw new Error("Der Stack besitzt keinen ausführbaren, geprüften Plan.");
  const byName = new Map(runtime.map((service) => [service.name, service]));
  const services = plan.phases.create.map((step) => {
    const source = byName.get(step.service);
    if (!source) throw new Error(`Laufzeitdaten für „${step.service}“ fehlen.`);
    return {
      service: step.service,
      containerName: step.containerName,
      image: source.image,
      variables: source.variables,
      ports: source.ports,
      volumes: source.volumes,
      network: step.networks[0] || "",
      cpus: Math.max(1, Math.round(Number(source.cpus) || 2)),
      memoryMb: memoryMegabytes(source.memory),
      restart: source.restart || "no",
      healthcheck: source.healthcheck,
    };
  });
  return {
    schema: 1,
    stackName: plan.stackName,
    planId: plan.planId,
    createdAt: options.createdAt || new Date().toISOString(),
    desiredState: options.desiredState || "running",
    services,
    checksum: createHash("sha256").update(JSON.stringify(services)).digest("hex"),
  };
}

export function recoveryActions(manifest, containers = []) {
  const status = new Map(containers.map((item) => [item.name, item.status]));
  if (manifest.desiredState !== "running") return [];
  return manifest.services
    .filter((service) => service.restart !== "no" && status.get(service.containerName) !== "running")
    .map((service) => ({ action: "start", containerName: service.containerName, service: service.service }));
}

export function safeStackSummary(manifest) {
  return {
    stackName: manifest.stackName,
    planId: manifest.planId,
    desiredState: manifest.desiredState,
    createdAt: manifest.createdAt,
    checksum: manifest.checksum,
    services: manifest.services.map(({ variables, ...service }) => ({ ...service, environmentVariables: variables.length })),
  };
}

export function verifyStackManifest(manifest) {
  if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.services)) return { valid: false, reason: "Ungültiges Stack-Format." };
  const checksum = createHash("sha256").update(JSON.stringify(manifest.services)).digest("hex");
  return checksum === manifest.checksum ? { valid: true } : { valid: false, reason: "Die Stack-Konfiguration wurde außerhalb von Apfel-Hafen verändert." };
}

// Recovery actions must only be derived from a manifest whose checksum still
// matches; a tampered manifest must not be able to steer which containers are
// (re)started. Returns both the integrity result and the (possibly empty)
// recovery list so callers can surface the integrity state.
export function stackRecovery(manifest, containers = []) {
  const integrity = verifyStackManifest(manifest);
  return { integrity, recovery: integrity.valid ? recoveryActions(manifest, containers) : [] };
}

// When restoring from a backup, the containers are stopped from the on-disk
// manifest while it is still trustworthy. If it is missing or tampered — the
// very situation restore exists for — the verified backup manifest is used
// instead, so a tampered stack can still be restored.
export function restoreStopSource(current, restored) {
  return current && verifyStackManifest(current).valid ? current : restored;
}
