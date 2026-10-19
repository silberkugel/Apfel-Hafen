import { createHash } from "node:crypto";
import { analyzeCompose } from "./compose-analysis.mjs";

const namePattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function safeName(value, fallback) {
  const normalized = String(value || fallback || "compose")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9._-]+$/g, "")
    .slice(0, 40);
  if (!normalized || !namePattern.test(normalized)) throw new Error("Der Stack-Name kann nicht sicher in einen Container-Namen umgewandelt werden.");
  return normalized;
}

function mappedResource(stackName, name) {
  return `${stackName}-${safeName(name, "default")}`.slice(0, 64);
}

function serviceStep(stackName, service) {
  const containerName = mappedResource(stackName, service.name);
  return {
    service: service.name,
    containerName,
    image: service.image,
    dependsOn: service.dependsOn,
    ports: service.ports,
    networks: service.networks.map((name) => mappedResource(stackName, name)),
    volumes: service.volumes.map((volume) => ({
      ...volume,
      source: volume.type === "volume" && volume.source ? mappedResource(stackName, volume.source) : volume.source,
    })),
    healthcheck: service.healthcheck,
    restart: service.restart,
    resources: service.resources,
  };
}

export function createComposePlan(source, options = {}) {
  const analysis = analyzeCompose(source, options);
  const stackName = safeName(options.stackName, analysis.project.name);
  const activeByName = new Map(analysis.services.filter((service) => service.active).map((service) => [service.name, service]));
  const create = analysis.startOrder.map((name) => serviceStep(stackName, activeByName.get(name)));
  const names = create.map((step) => step.containerName);
  if (new Set(names).size !== names.length) throw new Error("Mehrere Dienste würden denselben Container-Namen erhalten. Bitte einen kürzeren Stack- oder Dienstnamen verwenden.");

  const decisions = analysis.diagnostics
    .filter((item) => item.level === "error" || item.level === "warning")
    .map((item) => ({ code: item.code, level: item.level, service: item.service, message: item.message }));
  const ready = analysis.compatible && decisions.length === 0 && create.length === analysis.summary.activeServices;
  const fingerprint = createHash("sha256")
    .update(source)
    .update("\0")
    .update(String(options.envSource || ""))
    .update("\0")
    .update(JSON.stringify(analysis.profiles.selected))
    .digest("hex");

  return {
    readOnly: true,
    ready,
    planId: fingerprint.slice(0, 16),
    stackName,
    projectName: analysis.project.name,
    profiles: analysis.profiles.selected,
    summary: { services: create.length, networks: analysis.networks.length, volumes: analysis.volumes.length, decisions: decisions.length },
    phases: {
      networks: analysis.networks.map((name) => ({ composeName: name, runtimeName: mappedResource(stackName, name) })),
      volumes: analysis.volumes.map((name) => ({ composeName: name, runtimeName: mappedResource(stackName, name) })),
      create,
      start: create.map((step) => step.containerName),
      stop: create.map((step) => step.containerName).reverse(),
    },
    decisions,
  };
}

function publishedPort(value) {
  const match = String(value).trim().match(/^(?:(\d{1,5}):)?(\d{1,5})(?:\/(tcp|udp))?$/i);
  if (!match || !match[1]) return null;
  const hostPort = Number(match[1]);
  const containerPort = Number(match[2]);
  if (hostPort < 1 || hostPort > 65535 || containerPort < 1 || containerPort > 65535) return { unsupported: true, value: String(value) };
  return { hostPort, containerPort, protocol: (match[3] || "tcp").toLowerCase() };
}

export function preflightComposePlan(plan, containers = []) {
  if (!plan || plan.readOnly !== true || !plan.phases?.create) throw new Error("Der Compose-Ausführungsplan ist ungültig.");
  const conflicts = [];
  const existingNames = new Set(containers.map((container) => String(container.name || "").toLowerCase()).filter(Boolean));
  const occupiedPorts = new Map();
  for (const container of containers) for (const port of container.ports || []) {
    occupiedPorts.set(`${String(port.protocol || "tcp").toLowerCase()}:${Number(port.hostPort)}`, container.name);
  }
  const plannedPorts = new Map();

  for (const step of plan.phases.create) {
    if (existingNames.has(step.containerName.toLowerCase())) {
      conflicts.push({ code: "container-name-in-use", service: step.service, message: `Der Container-Name „${step.containerName}“ ist bereits vorhanden.` });
    }
    for (const value of step.ports || []) {
      const port = publishedPort(value);
      if (!port) continue;
      if (port.unsupported) {
        conflicts.push({ code: "unsupported-port", service: step.service, message: `Die Portfreigabe „${port.value}“ kann nicht sicher vorab geprüft werden.` });
        continue;
      }
      const key = `${port.protocol}:${port.hostPort}`;
      if (plannedPorts.has(key)) {
        conflicts.push({ code: "planned-port-conflict", service: step.service, message: `Port ${port.hostPort}/${port.protocol.toUpperCase()} wird im Stack bereits von „${plannedPorts.get(key)}“ verwendet.` });
      } else if (occupiedPorts.has(key)) {
        conflicts.push({ code: "host-port-in-use", service: step.service, message: `Port ${port.hostPort}/${port.protocol.toUpperCase()} ist bereits durch „${occupiedPorts.get(key)}“ belegt.` });
      }
      plannedPorts.set(key, step.service);
    }
  }

  return {
    readOnly: true,
    ready: plan.ready && conflicts.length === 0,
    planId: plan.planId,
    checkedAt: new Date().toISOString(),
    checks: {
      existingContainers: containers.length,
      plannedContainers: plan.phases.create.length,
      publishedPorts: plannedPorts.size,
    },
    conflicts,
  };
}
