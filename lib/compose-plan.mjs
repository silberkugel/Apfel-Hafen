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
